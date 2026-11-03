import { CREDENTIAL_MIN_CASES, myCredential, turnOffVerifyLink, turnOnVerifyLink } from "@/server/certificate";
import { requireUser } from "@/server/auth";
import { apiError, crossSite, handleError, ok, rateLimited } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/progress/certificate — this doctor's credential. */
export async function GET() {
  try {
    const user = await requireUser();
    if (user.isGuest) return apiError(403, "GUEST", "Sign in to keep a Clinical Rating.");
    return ok(await myCredential(user));
  } catch (err) {
    return handleError(err);
  }
}

/** POST — turns on the public verification link (their choice; it shows their name and scores). */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const mine = await myCredential(user);
    if (!mine.unlocked) return apiError(402, "LOCKED", "Invite 3 colleagues, or go Pro, to unlock the verified link.");
    if (mine.credential.ratedCases < CREDENTIAL_MIN_CASES) return apiError(400, "TOO_FEW", `Finish ${CREDENTIAL_MIN_CASES} rated cases first.`);
    return ok({ verifyId: await turnOnVerifyLink(user.id) });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE — turns the public link off. */
export async function DELETE(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 10);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    await turnOffVerifyLink(user.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
