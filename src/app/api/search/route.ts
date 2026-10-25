import { searchIndex } from "@/server/search-index";

export const dynamic = "force-static";

/** GET /api/search — the whole search index, cached; the search box filters it on the device. */
export function GET() {
  return Response.json(searchIndex(), { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
