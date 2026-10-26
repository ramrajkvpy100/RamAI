import { widgetData } from "@/server/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/widget?t=<key> — the home-screen progress widget's numbers (read-only; nothing personal beyond them). */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  try {
    const data = await widgetData(t);
    if (!data) return Response.json({ error: "unknown" }, { status: 404 });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
