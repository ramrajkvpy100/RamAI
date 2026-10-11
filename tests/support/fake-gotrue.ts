/**
 * A stand-in for Supabase Auth (GoTrue), for tests: the endpoints RamAI uses,
 * the same answers and error codes, real ES256-signed tokens with a JWKS
 * endpoint (as getClaims() expects), PKCE flows, and an outbox in place of
 * email. Never used by the app itself.
 */
import { createHash, generateKeyPairSync, randomBytes, randomInt, randomUUID, sign, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

interface FakeUser {
  id: string;
  email: string;
  password: string;
  confirmedAt: number | null;
  meta: Record<string, unknown>;
  createdAt: number;
  confirmation?: Token;
  recovery?: Token;
}

interface Token {
  otp: string;
  hash: string;
  sentAt: number;
  used: boolean;
  /** PKCE: the challenge the request came with. */
  challenge?: string;
}

export interface Mail {
  to: string;
  kind: "signup" | "recovery";
  /** The six-digit code ({{ .Token }}). */
  code: string;
  /** {{ .TokenHash }} */
  tokenHash: string;
  /** {{ .ConfirmationURL }} — Supabase's own verify link. */
  link: string;
  /** Where the link sends the browser afterwards. */
  redirectTo: string | null;
  sentAt: number;
}

interface Flow {
  userId: string;
  challenge: string;
  kind: "signup" | "recovery";
  authCode: string | null;
}

const OTP_TTL_MS = 3_600_000;
const COOLDOWN_MS = 60_000;

export interface FakeGoTrue {
  url: string;
  publishableKey: string;
  secretKey: string;
  outbox: Mail[];
  /** The newest email to an address. */
  lastMail(to: string, kind?: Mail["kind"]): Mail | undefined;
  /** Moves the clock used for codes, links and cooldowns (not token expiry). */
  advance(ms: number): void;
  /** How long access tokens last, in seconds (default 3600). */
  setAccessTokenTtl(seconds: number): void;
  users: Map<string, FakeUser>;
  /** Users whose sign-in was deleted through the admin API. */
  deleted: string[];
  /** The data API's stand-in for public.suggestions (same rules as the migration's row-level security). */
  suggestions: Record<string, unknown>[];
  /** Makes a user an admin (public.admins). */
  makeAdmin(email: string): void;
  /** Pretends the suggestions migration hasn't been run. */
  setSuggestionsTable(present: boolean): void;
  close(): Promise<void>;
}

export async function startFakeGoTrue(port = 0): Promise<FakeGoTrue> {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" }) as { privateKey: KeyObject; publicKey: KeyObject };
  const kid = randomUUID();
  const jwk = { ...(publicKey.export({ format: "jwk" }) as Record<string, string>), kid, alg: "ES256", use: "sig", key_ops: ["verify"] };
  const users = new Map<string, FakeUser>();
  const sessions = new Map<string, { userId: string; refresh: string; revoked: boolean; amr: { method: string; timestamp: number }[] }>();
  const refreshTokens = new Map<string, string>(); // refresh token → session id
  const flows = new Map<string, Flow>(); // flow id → flow
  const outbox: Mail[] = [];
  const deleted: string[] = [];
  let skew = 0;
  const suggestions: Record<string, unknown>[] = [];
  const admins = new Set<string>();
  let suggestionsTable = true;
  let accessTtl = 3600;
  const now = () => Date.now() + skew;
  const publishableKey = "sb_publishable_fake";
  const secretKey = "sb_secret_fake";
  let base = "";

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const userJson = (u: FakeUser) => ({
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.confirmedAt ? new Date(u.confirmedAt).toISOString() : null,
    confirmed_at: u.confirmedAt ? new Date(u.confirmedAt).toISOString() : null,
    confirmation_sent_at: u.confirmation ? new Date(u.confirmation.sentAt).toISOString() : null,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: u.meta,
    identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { email: u.email, sub: u.id } }],
    created_at: new Date(u.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  });

  function issueSession(u: FakeUser, method: string) {
    const sessionId = randomUUID();
    const refresh = randomBytes(16).toString("hex");
    const amr = [{ method, timestamp: Math.floor(Date.now() / 1000) }];
    sessions.set(sessionId, { userId: u.id, refresh, revoked: false, amr });
    refreshTokens.set(refresh, sessionId);
    return sessionBody(u, sessionId, refresh, amr);
  }

  function sessionBody(u: FakeUser, sessionId: string, refresh: string, amr: { method: string; timestamp: number }[]) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + accessTtl;
    const claims = { aud: "authenticated", exp, iat, iss: `${base}/auth/v1`, sub: u.id, email: u.email, phone: "", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.meta, role: "authenticated", aal: "aal1", amr, session_id: sessionId, is_anonymous: false };
    const unsigned = `${b64({ alg: "ES256", kid, typ: "JWT" })}.${b64(claims)}`;
    const signature = sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    return { access_token: `${unsigned}.${signature}`, token_type: "bearer", expires_in: accessTtl, expires_at: exp, refresh_token: refresh, user: userJson(u) };
  }

  /** The session behind a bearer token (signature checked loosely: it's our own token). */
  function bearer(req: IncomingMessage): { user: FakeUser; sessionId: string } | null {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; session_id: string; exp: number };
      if (claims.exp * 1000 < Date.now()) return null;
      const session = sessions.get(claims.session_id);
      const user = [...users.values()].find((u) => u.id === claims.sub);
      if (!session || session.revoked || !user) return null;
      return { user, sessionId: claims.session_id };
    } catch {
      return null;
    }
  }

  function newToken(challenge?: string): Token {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    return { otp, hash: randomBytes(28).toString("hex"), sentAt: now(), used: false, challenge };
  }

  function mail(u: FakeUser, kind: Mail["kind"], t: Token, redirectTo: string | null) {
    outbox.push({ to: u.email, kind, code: t.otp, tokenHash: t.hash, link: `${base}/auth/v1/verify?token=${t.hash}&type=${kind}${redirectTo ? `&redirect_to=${encodeURIComponent(redirectTo)}` : ""}`, redirectTo, sentAt: now() });
  }

  const live = (t: Token | undefined) => !!t && !t.used && now() - t.sentAt < OTP_TTL_MS;

  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  function send(res: ServerResponse, status: number, json?: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(json === undefined ? "" : JSON.stringify(json));
  }
  const fail = (res: ServerResponse, status: number, code: string, msg: string) => send(res, status, { code: status, error_code: code, msg });

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    const apikey = req.headers.apikey;
    if (path !== "/verify" && apikey !== publishableKey && apikey !== secretKey) return fail(res, 401, "no_authorization", "Invalid API key");

    if (url.pathname.startsWith("/rest/v1/")) return rest(req, res, url);
    if (req.method === "GET" && path === "/.well-known/jwks.json") return send(res, 200, { keys: [jwk] });

    if (req.method === "POST" && path === "/signup") {
      const b = await body(req);
      const email = String(b.email ?? "").toLowerCase();
      const password = String(b.password ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, "email_address_invalid", "Email address is invalid");
      if (password.length < 6) return fail(res, 422, "weak_password", "Password should be at least 6 characters.");
      const existing = users.get(email);
      if (existing?.confirmedAt) {
        // Supabase's obfuscated answer: a user-shaped object with no identities.
        return send(res, 200, { ...userJson(existing), id: randomUUID(), identities: [] });
      }
      if (existing?.confirmation && now() - existing.confirmation.sentAt < COOLDOWN_MS) return fail(res, 429, "over_email_send_rate_limit", "For security purposes, you can only request this after 60 seconds.");
      const u: FakeUser = existing ?? { id: randomUUID(), email, password, confirmedAt: null, meta: {}, createdAt: Date.now() };
      u.password = password;
      u.meta = (b.data as Record<string, unknown>) ?? {};
      u.confirmation = newToken(typeof b.code_challenge === "string" ? b.code_challenge : undefined);
      users.set(email, u);
      mail(u, "signup", u.confirmation, url.searchParams.get("redirect_to"));
      return send(res, 200, userJson(u));
    }

    if (req.method === "POST" && path === "/resend") {
      const b = await body(req);
      const u = users.get(String(b.email ?? "").toLowerCase());
      if (u && !u.confirmedAt) {
        if (u.confirmation && now() - u.confirmation.sentAt < COOLDOWN_MS) return fail(res, 429, "over_email_send_rate_limit", "For security purposes, you can only request this after 60 seconds.");
        u.confirmation = newToken(u.confirmation?.challenge);
        mail(u, "signup", u.confirmation, url.searchParams.get("redirect_to"));
      }
      return send(res, 200, {});
    }

    if (req.method === "POST" && path === "/recover") {
      const b = await body(req);
      const u = users.get(String(b.email ?? "").toLowerCase());
      if (u) {
        if (u.recovery && now() - u.recovery.sentAt < COOLDOWN_MS) return fail(res, 429, "over_email_send_rate_limit", "For security purposes, you can only request this after 60 seconds.");
        u.recovery = newToken(typeof b.code_challenge === "string" ? b.code_challenge : undefined);
        mail(u, "recovery", u.recovery, url.searchParams.get("redirect_to"));
      }
      return send(res, 200, {});
    }

    // A code typed in (email + token), or a token hash from a link.
    if (req.method === "POST" && path === "/verify") {
      const b = await body(req);
      const type = String(b.type ?? "");
      const pick = (u: FakeUser) => (type === "recovery" ? u.recovery : u.confirmation);
      let u: FakeUser | undefined;
      if (typeof b.token_hash === "string") u = [...users.values()].find((x) => pick(x)?.hash === b.token_hash);
      else {
        u = users.get(String(b.email ?? "").toLowerCase());
        if (u && pick(u)?.otp !== String(b.token ?? "")) u = undefined;
      }
      const t = u ? pick(u) : undefined;
      if (!u || !t || !live(t)) return fail(res, 403, "otp_expired", "Token has expired or is invalid");
      t.used = true;
      u.confirmedAt ??= Date.now();
      return send(res, 200, issueSession(u, type === "recovery" ? "recovery" : "otp"));
    }

    // Supabase's own link (the default email template): confirm, then redirect — with a PKCE code if the request had a challenge.
    if (req.method === "GET" && path === "/verify") {
      const hash = url.searchParams.get("token") ?? "";
      const type = url.searchParams.get("type") === "recovery" ? "recovery" : "signup";
      const redirect = url.searchParams.get("redirect_to") ?? base;
      const u = [...users.values()].find((x) => (type === "recovery" ? x.recovery : x.confirmation)?.hash === hash);
      const t = u ? (type === "recovery" ? u.recovery : u.confirmation) : undefined;
      if (!u || !t || !live(t)) {
        res.writeHead(303, { Location: `${redirect}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired` });
        return res.end();
      }
      t.used = true;
      u.confirmedAt ??= Date.now();
      const authCode = randomUUID();
      flows.set(authCode, { userId: u.id, challenge: t.challenge ?? "", kind: type, authCode });
      res.writeHead(303, { Location: `${redirect}${redirect.includes("?") ? "&" : "?"}code=${authCode}` });
      return res.end();
    }

    if (req.method === "POST" && path === "/token") {
      const grant = url.searchParams.get("grant_type");
      const b = await body(req);
      if (grant === "password") {
        const u = users.get(String(b.email ?? "").toLowerCase());
        if (!u || u.password !== String(b.password ?? "")) return fail(res, 400, "invalid_credentials", "Invalid login credentials");
        if (!u.confirmedAt) return fail(res, 400, "email_not_confirmed", "Email not confirmed");
        return send(res, 200, issueSession(u, "password"));
      }
      if (grant === "refresh_token") {
        const id = refreshTokens.get(String(b.refresh_token ?? ""));
        const s = id ? sessions.get(id) : undefined;
        const u = s ? [...users.values()].find((x) => x.id === s.userId) : undefined;
        if (!id || !s || s.revoked || !u) return fail(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        refreshTokens.delete(String(b.refresh_token));
        const refresh = randomBytes(16).toString("hex");
        s.refresh = refresh;
        refreshTokens.set(refresh, id);
        return send(res, 200, sessionBody(u, id, refresh, s.amr));
      }
      if (grant === "pkce") {
        const flow = flows.get(String(b.auth_code ?? ""));
        if (!flow) return fail(res, 404, "flow_state_not_found", "invalid flow state, no valid flow state found");
        const verifier = String(b.code_verifier ?? "");
        if (!verifier || createHash("sha256").update(verifier).digest("base64url") !== flow.challenge) return fail(res, 400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
        flows.delete(String(b.auth_code));
        const u = [...users.values()].find((x) => x.id === flow.userId)!;
        return send(res, 200, issueSession(u, flow.kind === "recovery" ? "recovery" : "otp"));
      }
      return fail(res, 400, "validation_failed", "unsupported grant type");
    }

    if (path === "/user" && (req.method === "GET" || req.method === "PUT")) {
      const who = bearer(req);
      if (!who) return fail(res, 403, "session_not_found", "Session from session_id claim in JWT does not exist");
      if (req.method === "PUT") {
        const b = await body(req);
        if (typeof b.password === "string") {
          if (b.password === who.user.password) return fail(res, 422, "same_password", "New password should be different from the old password.");
          who.user.password = b.password;
        }
      }
      return send(res, 200, userJson(who.user));
    }

    if (req.method === "POST" && path === "/logout") {
      const who = bearer(req);
      if (!who) return send(res, 204);
      const scope = url.searchParams.get("scope") ?? "global";
      for (const [id, s] of sessions) {
        if (s.userId !== who.user.id) continue;
        if (scope === "global" || (scope === "local" && id === who.sessionId) || (scope === "others" && id !== who.sessionId)) s.revoked = true;
      }
      return send(res, 204);
    }

    const adminDelete = path.match(/^\/admin\/users\/([0-9a-f-]+)$/);
    if (req.method === "DELETE" && adminDelete) {
      if (apikey !== secretKey && req.headers.authorization !== `Bearer ${secretKey}`) return fail(res, 403, "not_admin", "User not allowed");
      const u = [...users.values()].find((x) => x.id === adminDelete[1]);
      if (u) users.delete(u.email);
      deleted.push(adminDelete[1]!);
      return send(res, 200, {});
    }

    fail(res, 404, "not_found", `No fake for ${req.method} ${path}`);
  });

  /** A small PostgREST: public.suggestions and rpc/is_admin, enforcing the migration's rules. */
  async function rest(req: IncomingMessage, res: ServerResponse, url: URL) {
    const who = bearer(req);
    const uid = who?.user.id ?? null;
    const admin = !!uid && admins.has(uid);
    const pg = (status: number, code: string, message: string) => send(res, status, { code, message, details: null, hint: null });
    if (url.pathname === "/rest/v1/rpc/is_admin") return send(res, 200, admin);
    if (url.pathname !== "/rest/v1/suggestions") return pg(404, "PGRST205", `Could not find the table '${url.pathname.slice(9)}' in the schema cache`);
    if (!suggestionsTable) return pg(404, "PGRST205", "Could not find the table 'public.suggestions' in the schema cache");
    if (!uid) return pg(401, "42501", "permission denied for table suggestions");

    const params = url.searchParams;
    const filters = [...params].filter(([k]) => !["select", "order", "limit", "columns"].includes(k));
    const matches = (r: Record<string, unknown>) =>
      filters.every(([k, v]) => {
        const [op, ...rest] = v.split(".");
        const value = rest.join(".");
        if (op === "eq") return String(r[k]) === value;
        if (op === "ilike") return new RegExp(`^${value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*")}$`, "i").test(String(r[k] ?? ""));
        return true;
      });
    const visible = suggestions.filter((r) => admin || r.user_id === uid);
    const columns = (params.get("select") ?? "*").split(",").map((c) => c.trim());
    const project = (r: Record<string, unknown>) => (columns[0] === "*" ? r : Object.fromEntries(columns.map((c) => [c, r[c] ?? null])));
    const respond = (rows: Record<string, unknown>[], status = 200) => {
      const wantsOne = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      if ((req.headers.prefer ?? "").includes("count=exact")) res.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
      if (req.method === "HEAD") return send(res, 200);
      if (wantsOne) {
        if (rows.length !== 1) return pg(406, "PGRST116", `JSON object requested, multiple (or no) rows returned`);
        return send(res, status, project(rows[0]!));
      }
      return send(res, status, rows.map(project));
    };

    if (req.method === "GET" || req.method === "HEAD") {
      let rows = visible.filter(matches);
      const order = params.get("order");
      if (order) {
        const [col, dir] = order.split(".");
        rows = [...rows].sort((a, b) => String(a[col!]).localeCompare(String(b[col!])) * (dir === "desc" ? -1 : 1));
      }
      const limit = Number(params.get("limit") ?? 0);
      return respond(limit ? rows.slice(0, limit) : rows);
    }
    if (req.method === "POST") {
      const body = await body_(req);
      const list = Array.isArray(body) ? body : [body];
      const made: Record<string, unknown>[] = [];
      for (const b of list as Record<string, unknown>[]) {
        const row = { ...b, user_id: b.user_id ?? uid } as Record<string, unknown>;
        if (row.user_id !== uid) return pg(403, "42501", "new row violates row-level security policy for table \"suggestions\"");
        const message = String(row.message ?? "");
        if (!["idea", "problem", "case", "other"].includes(String(row.category)) || message.length < 10 || message.length > 2000) return pg(400, "23514", "new row violates check constraint");
        const now = new Date().toISOString();
        if (!admin) Object.assign(row, { status: "new", reply: null });
        made.push(Object.assign(row, { id: randomUUID(), status: row.status ?? "new", reply: row.reply ?? null, replied_at: row.reply ? now : null, page: row.page ?? null, created_at: now, updated_at: now }));
      }
      suggestions.push(...made);
      return respond(made, 201);
    }
    if (req.method === "PATCH") {
      const patch = (await body_(req)) as Record<string, unknown>;
      if (patch.status !== undefined && !["new", "reviewing", "planned", "done", "declined"].includes(String(patch.status))) return pg(400, "23514", "check constraint");
      const rows = admin ? visible.filter(matches) : [];
      const now = new Date().toISOString();
      for (const r of rows) {
        if (patch.status !== undefined) r.status = patch.status;
        if (patch.reply !== undefined && patch.reply !== r.reply) {
          r.reply = patch.reply;
          r.replied_at = patch.reply === null ? null : now;
        }
        r.updated_at = now;
      }
      return respond(rows);
    }
    if (req.method === "DELETE") {
      const rows = admin ? visible.filter(matches) : [];
      for (const r of rows) suggestions.splice(suggestions.indexOf(r), 1);
      return respond(rows);
    }
    return pg(405, "PGRST117", "Unsupported method");
  }
  const body_ = body;

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`;
  return {
    url: base,
    publishableKey,
    secretKey,
    outbox,
    users,
    deleted,
    suggestions,
    makeAdmin: (email) => {
      const u = users.get(email.toLowerCase());
      if (u) admins.add(u.id);
    },
    setSuggestionsTable: (present) => void (suggestionsTable = present),
    lastMail: (to, kind) => [...outbox].reverse().find((m) => m.to === to.toLowerCase() && (!kind || m.kind === kind)),
    advance: (ms) => void (skew += ms),
    setAccessTokenTtl: (s) => void (accessTtl = s),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
