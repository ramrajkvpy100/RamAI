import { z } from "zod";

import { getCurrentUser, requireUser } from "@/server/auth";
import { communityFailure, createPost, listPosts } from "@/server/community";
import { TOPIC_IDS, type Topic } from "@/lib/community";
import { crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.object({
  topic: z.enum(TOPIC_IDS as [Topic, ...Topic[]]),
  title: z.string().trim().min(6, "Give it a title of at least 6 characters.").max(140, "Keep the title under 140 characters."),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(5000, "Keep it under 5,000 characters."),
  shareId: z.string().max(120).nullable().optional(),
  spoiler: z.boolean().optional(),
});

/** GET /api/community?topic=&before= — the feed. Open to everyone. */
export async function GET(req: Request) {
  const blocked = rateLimited(req, 120);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic");
  const before = Number(url.searchParams.get("before")) || undefined;
  try {
    const viewer = await getCurrentUser().catch(() => null);
    return ok(await listPosts({ topic: TOPIC_IDS.includes(topic as Topic) ? (topic as Topic) : undefined, before, viewerId: viewer?.id }));
  } catch (err) {
    return communityFailure(err);
  }
}

/** POST /api/community — a new post (a free account; read by the model first). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, PostSchema);
  if (body instanceof Response) return body;
  try {
    return ok(await createPost(await requireUser(), body));
  } catch (err) {
    return communityFailure(err);
  }
}
