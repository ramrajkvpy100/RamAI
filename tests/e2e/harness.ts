/**
 * The real RamAI server (a production build) against a stand-in for Supabase,
 * and a cookie-keeping "browser" to drive it. For end-to-end tests:
 *   npx next build && RAMAI_E2E=1 npx vitest run tests/e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { startFakeGoTrue, type FakeGoTrue } from "../support/fake-gotrue";

export const E2E = process.env.RAMAI_E2E === "1" && existsSync(".next/BUILD_ID");

export interface Stack {
  base: string;
  auth: FakeGoTrue;
  stop(): Promise<void>;
}

export async function startStack(port: number): Promise<Stack> {
  const auth = await startFakeGoTrue();
  const dir = mkdtempSync(path.join(tmpdir(), "ramai-e2e-"));
  const base = `http://localhost:${port}`;
  const server: ChildProcess = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      RAMAI_DB_PATH: path.join(dir, "e2e.db"),
      RAMAI_BACKUP_INTERVAL_HOURS: "0",
      RAMAI_SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-123",
      RAMAI_APP_URL: base,
      RAMAI_ADMIN_EMAILS: "admin.doc@example.com",
      NEXT_PUBLIC_SUPABASE_URL: auth.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: auth.publishableKey,
      SUPABASE_SECRET_KEY: auth.secretKey,
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    if ((await fetch(base).catch(() => null))?.ok) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    base,
    auth,
    stop: async () => {
      server.kill();
      await auth.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A browser, minus the rendering: keeps cookies and sends requests like one. */
export class Browser {
  jar = new Map<string, string>();
  constructor(private base: string) {}
  async go(p: string, init: { json?: unknown; method?: string } = {}) {
    const headers = new Headers({ origin: this.base });
    if (this.jar.size) headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    if (init.json !== undefined) headers.set("content-type", "application/json");
    const res = await fetch(p.startsWith("http") ? p : this.base + p, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), headers, body: init.json !== undefined ? JSON.stringify(init.json) : undefined, redirect: "manual" });
    for (const raw of res.headers.getSetCookie()) {
      const [pair = "", ...attrs] = raw.split(";");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at).trim();
      const value = pair.slice(at + 1);
      const gone = !value || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || attrs.some((a) => /^\s*expires=/i.test(a) && Date.parse(a.split("=")[1]!) < Date.now());
      if (gone) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return res;
  }
  post = (p: string, json: unknown = {}) => this.go(p, { json });
  async api(p: string, json?: unknown, method?: string) {
    const res = json === undefined && !method ? await this.go(p) : await this.go(p, { json: json ?? {}, method });
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } & Record<string, unknown>;
    return { status: res.status, body, code: body?.error?.code };
  }
  signedIn = () => [...this.jar.keys()].some((k) => /^sb-.*-auth-token(\.\d+)?$/.test(k));
}

/** Signs a new player up and verifies them with the emailed code. */
export async function signUp(stack: Stack, who: { email: string; username: string; name: string }, password = "violet kestrel 2026") {
  const b = new Browser(stack.base);
  await b.api("/api/auth/signup", { ...who, password, country: "IN", acceptTerms: true });
  const res = await b.api("/api/auth/verify", { email: who.email, code: stack.auth.lastMail(who.email, "signup")!.code });
  if (res.status !== 200) throw new Error(`verify failed: ${JSON.stringify(res.body)}`);
  return b;
}
