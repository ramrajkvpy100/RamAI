import type { Country } from "@/engine/countries";
import type { PatientLang } from "@/engine/types";
import { requireUser, setCountry, setPatientLang } from "@/server/auth";
import { meFor } from "@/server/me";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { SettingsSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/me/settings — player preferences: patient language, country. */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 30);
  if (blocked) return blocked;
  const body = await parseBody(req, SettingsSchema);
  if (body instanceof Response) return body;
  try {
    const user = await requireUser();
    const next = { ...user };
    if (body.patientLang) {
      await setPatientLang(user.id, body.patientLang as PatientLang);
      next.patientLang = body.patientLang as PatientLang;
    }
    if (body.country) {
      await setCountry(user.id, body.country as Country);
      next.country = body.country as Country;
    }
    return ok(await meFor(next));
  } catch (err) {
    return handleError(err);
  }
}
