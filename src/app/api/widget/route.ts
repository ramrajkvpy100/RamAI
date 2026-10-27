import { widgetData, widgetToggle } from "@/server/widget";
import { rateLimited } from "@/lib/server/http";

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

/** POST /api/widget?t=<key>&d=<day>&kind=mit|todo|habit&id=<id> — tick a planner item from the home screen. */
export async function POST(req: Request) {
  const limited = rateLimited(req, 60);
  if (limited) return limited;
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind");
  if (kind !== "mit" && kind !== "todo" && kind !== "habit") return Response.json({ error: "kind" }, { status: 400 });
  try {
    const ok = await widgetToggle(q.get("t") ?? "", q.get("d") ?? undefined, kind, (q.get("id") ?? "").slice(0, 40));
    return Response.json({ ok }, { status: ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
