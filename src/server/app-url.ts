import "server-only";

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|::1|.+\.localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * Where links in emails point back to. RAMAI_APP_URL if set; on Vercel, its
 * production address; otherwise the request's own host — but only a local
 * one: a forged Host header must never decide where a password-reset link goes.
 */
export function appUrl(req: Request): string | null {
  const configured = process.env.RAMAI_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const host = req.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "").replace(/^\[(.*)\]$/, "$1");
  if (!PRIVATE_HOST.test(hostname)) {
    console.error("[ramai] Set RAMAI_APP_URL so account emails can link back to the app.");
    return null;
  }
  return `${req.headers.get("x-forwarded-proto") === "https" ? "https" : "http"}://${host}`;
}
