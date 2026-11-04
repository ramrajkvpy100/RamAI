import type { Metadata } from "next";

import { Welcome } from "@/components/onboarding/welcome";

export const metadata: Metadata = { title: "Welcome", description: "Pick your dream branch and see how RamAI helps you get there." };

export default function Page() {
  return <Welcome />;
}
