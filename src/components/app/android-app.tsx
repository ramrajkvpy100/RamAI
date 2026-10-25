"use client";

import { isLiteDevice } from "@/lib/low-data";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { inAndroidApp, useInAndroidApp } from "@/lib/in-app";

/** Notes on the app's first page that this tab is the Android app (the referrer is only there on that page). */
export function AndroidAppMarker() {
  useEffect(() => {
    inAndroidApp();
    // Old and low-end phones (and the app): decorative, never-ending animations stop (see .lite in globals.css).
    if (isLiteDevice()) document.documentElement.classList.add("lite");
  }, []);
  return null;
}

/** Hides what the Android app mustn't show (buying Pro, gifts). */
export function NotInAndroidApp({ children, instead = null }: { children: ReactNode; instead?: ReactNode }) {
  return useInAndroidApp() ? instead : children;
}

/** The footer's Pricing and Donate links — not in the Android app. */
export function ShopLinks() {
  return (
    <NotInAndroidApp>
      <Link href="/pricing" className="hover:text-fg">
        Pricing
      </Link>
      <Link href="/support" className="hover:text-fg">
        Donate
      </Link>
    </NotInAndroidApp>
  );
}

/** What the pricing and gift pages say inside the Android app: no prices, no links out. */
export function NotSoldInApp() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Not available in the app</h1>
      <p className="mt-2 text-[14.5px] leading-6 text-fg-2">Upgrades and gifts aren&apos;t offered in the Android app. Your free cases each day work here as usual.</p>
    </div>
  );
}
