import { z } from "zod";

import { getCurrentUser, userOrGuest } from "@/server/auth";
import { countryFromIp } from "@/lib/plans";
import { overLimit } from "@/server/rate-limit";
import { communityFailure, createPost, listPosts } from "@/server/community";
import { TOPIC_IDS, type Topic } from "@/lib/community";
import { apiError, clientIp, crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";

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

/** POST /api/community — a new post: anyone (a visitor joins as a guest); read by the model first. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  const body = await parseBody(req, PostSchema);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser();
    if (!user && (await overLimit(`guest:${clientIp(req)}`, 20, 3_600_000))) return apiError(429, "RATE_LIMITED", "Too many new guests from this network. Please try again later.");
    return ok(await createPost(user ?? (await userOrGuest(countryFromIp(req.headers.get("x-vercel-ip-country")))), body));
  } catch (err) {
    return communityFailure(err);
  }
}
