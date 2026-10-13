import { z } from "zod";

import { getCurrentUser, userOrGuest } from "@/server/auth";
import { countryFromIp } from "@/lib/plans";
import { overLimit } from "@/server/rate-limit";
import { communityFailure, createReply, getPost } from "@/server/community";
import { apiError, clientIp, crossSite, ok, parseBody, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().uuid();
const ReplySchema = z.object({ body: z.string().trim().min(2, "Write a little more.").max(3000, "Keep it under 3,000 characters.") });

/** GET /api/community/:id — a post with its replies. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rateLimited(req, 120);
  if (blocked) return blocked;
  const id = Id.safeParse((await params).id);
  if (!id.success) return apiError(404, "NOT_FOUND", "That post isn't there.");
  try {
    const viewer = await getCurrentUser().catch(() => null);
    const post = await getPost(id.data, viewer?.id);
    return post ? ok({ post }) : apiError(404, "NOT_FOUND", "That post isn't there any more.");
  } catch (err) {
    return communityFailure(err);
  }
}

/** POST /api/community/:id — a reply. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const id = Id.safeParse((await params).id);
  if (!id.success) return apiError(404, "NOT_FOUND", "That post isn't there.");
  const body = await parseBody(req, ReplySchema);
  if (body instanceof Response) return body;
  try {
    const user = await getCurrentUser();
    if (!user && (await overLimit(`guest:${clientIp(req)}`, 20, 3_600_000))) return apiError(429, "RATE_LIMITED", "Too many new guests from this network. Please try again later.");
    return ok({ reply: await createReply(user ?? (await userOrGuest(countryFromIp(req.headers.get("x-vercel-ip-country")))), id.data, body.body) });
  } catch (err) {
    return communityFailure(err);
  }
}
