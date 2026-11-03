import type { Metadata } from "next";

import { ProgressShell } from "@/components/app/me-pages";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <ProgressShell />;
}
