import { headers } from "next/headers";

import { AppShell } from "@/components/app/app-shell";
import { Home } from "@/components/home/home";
import { Landing } from "@/components/landing/landing";
import { caseAvailability } from "@/engine/engine";
import { countryFromIp } from "@/lib/plans";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getMe();
  if (!me) {
    const ip = (await headers()).get("x-vercel-ip-country");
    return <Landing country={ip ? countryFromIp(ip) : undefined} />;
  }
  const library = await caseAvailability(me.user.country);
  return (
    <AppShell me={me} wide>
      <Home initial={me} library={library} />
    </AppShell>
  );
}
