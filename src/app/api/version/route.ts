export const dynamic = "force-dynamic";

/** GET /api/version — the deployment this server runs; an open tab on an older one reloads itself. */
export function GET() {
  return Response.json({ v: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}
