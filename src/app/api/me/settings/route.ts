import type { Country } from "@/engine/countries";
import type { PatientLang } from "@/engine/types";
import { AuthError, requireUser, setCountry, setPatientLang, setGeo, setProfileDetails, setSpecialty } from "@/server/auth";
import type { PreferredSpecialty } from "@/lib/specialty";
import { meFor } from "@/server/me";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { SettingsSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/me/settings — player preferences: patient language, country, their own specialty. */
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
    if (body.specialty) {
      await setSpecialty(user.id, body.specialty as PreferredSpecialty);
      next.specialty = body.specialty as PreferredSpecialty;
    }
    if (body.bio !== undefined || body.city !== undefined || body.college !== undefined) {
      if (user.isGuest) throw new AuthError("UNAUTHENTICATED", "Sign up to fill in your profile.");
      await setProfileDetails(user.id, { bio: body.bio, city: body.city, college: body.college });
      if (body.bio !== undefined) next.bio = body.bio.trim() || null;
      if (body.city !== undefined) next.city = body.city.trim() || null;
      if (body.college !== undefined) next.college = body.college.trim() || null;
    }
    if (body.geo !== undefined) {
      if (user.isGuest) throw new AuthError("UNAUTHENTICATED", "Sign up to compete with doctors near you.");
      await setGeo(user.id, body.geo);
      next.geo = body.geo ? { lat: Math.round(body.geo.lat * 10) / 10, lon: Math.round(body.geo.lon * 10) / 10 } : null;
    }
    return ok(await meFor(next));
  } catch (err) {
    return handleError(err);
  }
}
