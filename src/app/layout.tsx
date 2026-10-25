import { RefCapture } from "@/components/app/ref-capture";
import { HapticTouches } from "@/components/app/haptic-touches";
import { FocusPill } from "@/components/focus/focus-pill";
import { Toaster } from "@/components/shell/toaster";
import type { Metadata, Viewport } from "next";
import { AndroidAppMarker } from "@/components/app/android-app";
import { VersionCheck } from "@/components/app/version-check";
import { CopyGuard } from "@/components/app/copy-guard";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { ServiceWorker } from "@/components/app/service-worker";
import { StartingOverlay } from "@/components/app/starting-overlay";
import { SITE } from "@/lib/site";

import "./globals.css";
import { QuickSuggest } from "@/components/suggestions/quick-suggest";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  // Shared cards' link previews need absolute addresses.
  metadataBase: new URL(SITE.url),
  title: { default: "RamAI — Think like a doctor, every day", template: "%s · RamAI" },
  description: "Clinical case simulator for doctors and medical students: virtual patients, real decisions, a scored debrief. Skills Lab (ECG, X-ray, CT, ultrasound, heart sounds) and NEET PG, USMLE and PLAB-style MCQs. Free — India, USA and UK.",
  keywords: ["clinical case simulator", "virtual patient", "medical case simulation", "NEET PG preparation", "USMLE clinical cases", "PLAB", "ECG practice", "X-ray quiz", "medical student app", "clinical reasoning"],
  applicationName: "RamAI",
  // Added to an iPhone's Home Screen it opens full-screen, named RamAI.
  appleWebApp: { capable: true, title: "RamAI", statusBarStyle: "default" },
  // Vitals and doses aren't phone numbers.
  formatDetection: { telephone: false },
  // Public pages can be found in search; the invite page, the app's own pages and the API say no themselves (and in robots.txt).
  robots: { index: true, follow: true },
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: "RamAI", url: SITE.url },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#05070d" },
  ],
};

/** Applies the stored theme before first paint — no flash — and follows the system theme live on every page. */
const THEME_SCRIPT = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");var a=function(){try{var p=localStorage.getItem("ramai.theme");var d=p==="dark"||(p==="system"&&m.matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}};a();m.addEventListener("change",a);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The per-request nonce from src/proxy.ts — the Content-Security-Policy only runs scripts that carry it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        {children}
        <RefCapture />
        <AndroidAppMarker />
        <StartingOverlay />
        <ServiceWorker />
        <VersionCheck />
        <CopyGuard />
        <QuickSuggest />
        <Toaster />
        <FocusPill />
        <HapticTouches />
      </body>
    </html>
  );
}
