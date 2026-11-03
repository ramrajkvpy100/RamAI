import type { Metadata } from "next";

import { HomeShell } from "@/components/app/shells/home-shell";

export const metadata: Metadata = { title: "Home", robots: { index: false } };

/** A signed-in doctor's home, served from the CDN and drawn on the phone: the tab that opens at once. */
export default function HomePage() {
  return <HomeShell />;
}
