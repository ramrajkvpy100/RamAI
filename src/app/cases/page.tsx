import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Home } from "@/components/home/home";
import { caseAvailability } from "@/engine/engine";

import { getMe } from "@/server/me";

/** The cases screen: start a case, the daily case, your path and league. (Home is at /.) */
export const dynamic = "force-dynamic";
export const metadata = { title: "Cases" };

export default async function CasesPage() {
  const me = await getMe();
  if (!me) redirect("/");
  const library = await caseAvailability(me.user.country);
  return (
    <AppShell me={me} wide>
      <Home initial={me} library={library} />
    </AppShell>
  );
}
