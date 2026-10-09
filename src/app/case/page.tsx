import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaseScreen } from "@/components/case/case-screen";
import { getMe } from "@/server/me";

export const metadata: Metadata = { title: "Case" };
export const dynamic = "force-dynamic";

export default async function CasePage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/case");
  return <CaseScreen me={me} />;
}
