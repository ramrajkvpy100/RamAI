import type { Metadata } from "next";

import { ProgressShell } from "@/components/app/shells/progress-shell";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <ProgressShell />;
}
