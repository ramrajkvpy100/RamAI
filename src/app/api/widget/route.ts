import { widgetData } from "@/server/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/widget?t=<key> — the home-screen progress widget's numbers (read-only; nothing personal beyond them). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const t = q.get("t") ?? "";
  try {
    const data = await widgetData(t, q.get("d") ?? undefined);
    if (!data) return Response.json({ error: "unknown" }, { status: 404 });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
