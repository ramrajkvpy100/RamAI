/**
 * The invite pass: a signed cookie saying this browser was let in (with a valid invite code, or by
 * an allowed account). Web Crypto only, so the proxy can check it before any page renders.
 */
export const ACCESS_COOKIE = "ramai_access";
const YEAR_MS = 365 * 86_400_000;

/** Invite-only unless RAMAI_INVITE_ONLY is "0". */
export const inviteOnly = () => process.env.RAMAI_INVITE_ONLY !== "0";

function secret(): string {
  const s = process.env.RAMAI_SESSION_SECRET || process.env.OPENAI_API_KEY || process.env.RAMAI_MAIN_DB_TOKEN || "";
  return `ramai/access/v1:${s}`;
}

async function sign(text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeAccessCookie(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const until = now + YEAR_MS;
  return { value: `1.${until}.${await sign(`1.${until}`)}`, maxAge: YEAR_MS / 1000 };
}

export async function validAccessCookie(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [v, until, mac] = value.split(".");
  if (v !== "1" || !until || !mac || Number(until) < now) return false;
  return (await sign(`1.${until}`)) === mac;
}
