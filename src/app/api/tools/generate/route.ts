import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { requireUser } from "@/server/auth";
import { overLimit } from "@/server/rate-limit";
import { cachedTool, writeTool, youtubeId, youtubeText, type ToolKind } from "@/server/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Generate = z.object({
  kind: z.enum(["mnemonic", "flowchart", "summary", "notes"]),
  /** A topic, a YouTube link, or the doctor's notes. */
  text: z.string().trim().min(2).max(24_000),
  /** A transcript the doctor pasted for a video. */
  transcript: z.string().trim().max(24_000).optional(),
});
const TOOLS_A_DAY = 5;

/** POST /api/tools/generate: AI study material. Each new one is a paid model call: accounts only, 5 a day; repeats are free. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 15);
  if (blocked) return blocked;
  const body = await parseBody(req, Generate);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "SIGNUP_REQUIRED", "Sign in free to use the AI tools. The ready-made galleries are open to everyone.");
    let input = body.text;
    let from: "video" | "topic" | "notes" = body.kind === "notes" ? "notes" : "topic";
    let title: string | null = null;
    const video = body.kind === "summary" ? youtubeId(body.text) : null;
    if (body.transcript) {
      input = `Lecture transcript:\n${body.transcript}`;
      from = "video";
    } else if (video) {
      const got = await youtubeText(video);
      title = got.title;
      // No captions for us, and no way to know what's in the video: asking the model would be making it up.
      if (!got.transcript) return ok({ needTranscript: true, title });
      input = `Lecture "${got.title ?? "video"}" transcript:\n${got.transcript}`;
      from = "video";
    }
    const kind = body.kind as ToolKind;
    const kept = await cachedTool(kind, input);
    if (kept) return ok({ result: kept, from, title, cached: true });
    if (user.plan !== "pro" && (await overLimit(`tools:${user.id}`, TOOLS_A_DAY, 86_400_000))) return apiError(429, "RATE_LIMITED", `That's today's ${TOOLS_A_DAY} AI generations. They come back tomorrow, and the galleries stay open.`);
    const result = await withUsage({ kind: "practice" }, () => writeTool(kind, input));
    return result ? ok({ result, from, title }) : apiError(503, "UNAVAILABLE", "That didn't come out right. Please try again in a moment.");
  } catch (err) {
    return handleError(err);
  }
}
