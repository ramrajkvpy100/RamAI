import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CaseShell } from "@/components/app/me-pages";
import { maybeSignedIn } from "@/lib/server/signed-in";

export const metadata: Metadata = { title: "Case" };
export const dynamic = "force-dynamic";

export default async function CasePage() {
  if (!(await maybeSignedIn())) redirect("/login?next=/case");
  return <CaseShell />;
}
