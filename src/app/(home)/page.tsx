import { headers } from "next/headers";

import { AppShell } from "@/components/app/app-shell";
import { Home } from "@/components/home/home";
import { Landing } from "@/components/landing/landing";
import { INVESTIGATIONS } from "@/engine/catalog";
import { caseAvailability } from "@/engine/engine";
import { FORMULARY } from "@/engine/formulary";
import { CARE_LEVELS } from "@/engine/types";

/** Specialties a case can be in (engine/types Specialty). */
const SPECIALTY_COUNT = 19;
import { countryFromIp } from "@/lib/plans";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getMe();
  if (!me) {
    const ip = (await headers()).get("x-vercel-ip-country");
    return <Landing country={ip ? countryFromIp(ip) : undefined} stats={{ drugs: FORMULARY.length, tests: INVESTIGATIONS.length, specialties: SPECIALTY_COUNT, countries: 3, levels: CARE_LEVELS.length }} />;
  }
  const library = await caseAvailability(me.user.country);
  return (
    <AppShell me={me} wide>
      <Home initial={me} library={library} />
    </AppShell>
  );
}
