import { requireUser } from "@/server/auth";
import { creditsLeft, personalInvite, referralCount } from "@/server/credits";
import { handleError, ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me/invite — the profile's invite card: free cases left, friends who joined, your invite code. */
export async function GET() {
  try {
    const user = await requireUser();
    if (user.isGuest) return ok({ invite: null });
    const [credits, friends, invite] = await Promise.all([creditsLeft(user.id).catch(() => 0), referralCount(user.id).catch(() => 0), personalInvite(user.username).catch(() => ({ code: null, left: 0 }))]);
    return ok({ invite: { username: user.username, credits, friends, ...invite } });
  } catch (err) {
    return handleError(err);
  }
}
