import type { Metadata } from "next";

import { CaseShell } from "@/components/app/shells/case-shell";

export const metadata: Metadata = { title: "Case" };

export default function CasePage() {
  return <CaseShell />;
}
