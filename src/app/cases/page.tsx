import { CasesShell } from "@/components/app/shells/cases-shell";

/** The cases screen: start a case, the daily case, your path and league. (Home is at /.) */
export const metadata = { title: "Cases" };

export default function CasesPage() {
  return <CasesShell />;
}
