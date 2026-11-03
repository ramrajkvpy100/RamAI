import type { NextConfig } from "next";

import { SCAN_BASE, SCAN_HOST } from "./src/lib/scans";

const dev = process.env.NODE_ENV === "development";
/**
 * One fixed policy, so pages can be served from the CDN and prefetched into the phone's memory. Scripts still come only
 * from RamAI, Razorpay's checkout and Google sign-in; 'unsafe-inline' is needed because Next.js writes small inline scripts
 * into static pages (they can't carry a per-visit nonce).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com/gsi/client${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  `img-src 'self' data: blob: https://cdn.razorpay.com ${SCAN_HOST}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SCAN_HOST} https://accounts.google.com/gsi/ https://api.razorpay.com https://lumberjack.razorpay.com${dev ? " ws: wss:" : ""}`,
  "frame-src https://accounts.google.com/gsi/ https://api.razorpay.com https://checkout.razorpay.com",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** Sent with every response. */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // The microphone is RamAI's own voice input; nothing else gets device access.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Razorpay's checkout may open payment pop-ups (UPI, bank pages).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The scans moved to Cloudflare R2: an app still holding an old address finds them there.
  async redirects() {
    return [{ source: "/radiology/:path+", destination: `${SCAN_BASE}/:path+`, permanent: false }];
  },
  // Some tools still look for the manifest under its older name.
  async rewrites() {
    return [{ source: "/manifest.json", destination: "/manifest.webmanifest" }];
  },
  reactStrictMode: true,
  // Stamped into the page, so an open tab can tell when the site has moved on (see VersionCheck).
  env: { NEXT_PUBLIC_RAMAI_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  poweredByHeader: false,
  // Pages already visited (or prefetched from the tab bar) open at once from the phone's memory, refreshed behind.
  experimental: { staleTimes: { dynamic: 120, static: 600 } },
  // The share cards draw RamAI's heart from this picture: it must travel with the function.
  outputFileTracingIncludes: { "/api/share/**": ["./src/server/assets/**/*"] },
  // Nothing here uses sharp (Vercel resizes images itself), and the local database stays local: without these every
  // function carried about 18 MB it never opens, in every deployment kept.
  outputFileTracingExcludes: { "/**": ["node_modules/sharp/**/*", "node_modules/@img/**/*", "data/**/*"] },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // Focus scenes, drinks, animations and level pictures: kept by the phone for a week (they rarely change).
      // Media files only (the /focus and /radiology pages themselves must never be cached like this).
      { source: "/:dir(focus|anim|levels)/:file([^/]+\\.(?:webp|png|jpg|jpeg|mp4|webm|mp3|m4a|ogg))", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }] },
      // Account data must never be cached by a browser or CDN. (Share cards and practice pictures are public — they set their own.)
      { source: "/api/:path((?!share/|practice/image/).*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
