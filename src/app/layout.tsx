import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { ServiceWorker } from "@/components/app/service-worker";

import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "RamAI — Think like a doctor, every day", template: "%s · RamAI" },
  description: "Clinical case simulation for doctors and medical students. Real patients, hidden diagnoses, no hints — from first-contact care to the world's hardest cases. India, USA and UK.",
  applicationName: "RamAI",
  // Added to an iPhone's Home Screen it opens full-screen, named RamAI.
  appleWebApp: { capable: true, title: "RamAI", statusBarStyle: "default" },
  // Vitals and doses aren't phone numbers.
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
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
const THEME_SCRIPT = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");var a=function(){try{var p=localStorage.getItem("ramai.theme");var d=p==="dark"||((!p||p==="system")&&m.matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}};a();m.addEventListener("change",a);}catch(e){}})();`;

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
        <ServiceWorker />
      </body>
    </html>
  );
}
