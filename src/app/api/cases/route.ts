import { simulateCase } from "@/engine/engine";
import type { CareLevel, CaseTrack, Specialty } from "@/engine/types";
import { requireUser } from "@/server/auth";
import { casesStartedToday, recentCaseRefs, recordCaseStart, totalCasesStarted } from "@/server/results";
import { ensureDemoPlayers } from "@/server/seed";
import { apiError, crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { StartSchema } from "@/lib/server/schemas";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cases — start a case within the player's plan, or the free guided demo case. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, StartSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    await ensureDemoPlayers();
    const tutorial = body.tutorial === true;
    if (user.isGuest && !tutorial) {
      return apiError(403, "SIGNUP_REQUIRED", "Create a free account to play more cases — it takes 30 seconds.");
    }
    const plan = PLANS[user.plan];
    if (!tutorial && body.level && !plan.levels.includes(body.level as CareLevel)) {
      return apiError(402, "PRO_REQUIRED", "This level is part of RamAI Pro.");
    }
    if (!tutorial && plan.dailyCases !== null && (await casesStartedToday(user.id)) >= plan.dailyCases) {
      return apiError(402, "DAILY_LIMIT", `You've used today's ${plan.dailyCases} free cases. They refresh at midnight — or go Pro for unlimited cases.`);
    }
    const session = await simulateCase({
      userId: user.id,
      caseNumber: (await totalCasesStarted(user.id)) + 1,
      specialty: body.specialty as Specialty | undefined,
      track: body.track as CaseTrack | undefined,
      level: body.level as CareLevel | undefined,
      allowedLevels: plan.levels,
      exclude: await recentCaseRefs(user.id),
      lang: user.patientLang,
      tutorial,
      country: user.country,
    });
    await recordCaseStart(user.id, session.state.sessionId, tutorial);
    return ok(session);
  } catch (err) {
    return handleError(err);
  }
}
