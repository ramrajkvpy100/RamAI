import { AppShell } from "@/components/app/app-shell";
import { Home } from "@/components/home/home";
import { Landing } from "@/components/landing/landing";
import { caseAvailability } from "@/engine/engine";
import { getMe } from "@/server/me";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getMe();
  if (!me) return <Landing />;
  const library = await caseAvailability();
  return (
    <AppShell me={me} wide>
      <Home initial={me} library={library} />
    </AppShell>
  );
}
