"use client";

import { useShellMe } from "@/components/app/client-shell";
import { CaseScreen } from "@/components/case/case-screen";
import { PageLoading } from "@/components/shell/page-loading";

export function CaseShell() {
  const { me } = useShellMe("/login?next=/case");
  return me ? <CaseScreen me={me} /> : <PageLoading />;
}
