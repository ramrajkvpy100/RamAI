import { headers } from "next/headers";

import { HomeShell } from "@/components/app/shells/home-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { Landing } from "@/components/landing/landing";
import { INVESTIGATIONS } from "@/engine/catalog";
import { FORMULARY } from "@/engine/formulary";
import { CARE_LEVELS } from "@/engine/types";

/** Specialties a case can be in (engine/types Specialty). */
const SPECIALTY_COUNT = 19;
import { countryFromIp } from "@/lib/plans";
import { maybeSignedIn } from "@/lib/server/signed-in";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ landing?: string }> }) {
  // The server waits on nothing: a signed-in doctor's home is drawn on the phone, a visitor gets the landing page.
  if ((await maybeSignedIn()) && (await searchParams).landing !== "1") return <HomeShell />;
  const ip = (await headers()).get("x-vercel-ip-country");
  return (
    <>
      <JsonLd faq />
      <Landing country={ip ? countryFromIp(ip) : undefined} stats={{ drugs: FORMULARY.length, tests: INVESTIGATIONS.length, specialties: SPECIALTY_COUNT, countries: 3, levels: CARE_LEVELS.length }} />
    </>
  );
}
