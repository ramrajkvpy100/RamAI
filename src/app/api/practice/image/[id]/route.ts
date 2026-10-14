import { picture } from "@/server/practice";

export const runtime = "nodejs";

/** GET /api/practice/image/:id — a drill's picture. Public teaching images; they never change once kept. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const p = await picture(id);
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "public, max-age=31536000, immutable" } });
}
