import type { NextConfig } from "next";

/** Sent with every response. The Content-Security-Policy for pages is set per request in src/proxy.ts. */
const SECURITY_HEADERS = [
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
  reactStrictMode: true,
  // Stamped into the page, so an open tab can tell when the site has moved on (see VersionCheck).
  env: { NEXT_PUBLIC_RAMAI_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  poweredByHeader: false,
  // The share cards draw RamAI's heart from this picture: it must travel with the function.
  outputFileTracingIncludes: { "/api/share/**": ["./src/server/assets/**/*"] },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // Account data must never be cached by a browser or CDN. (Share cards and practice pictures are public — they set their own.)
      { source: "/api/:path((?!share/|practice/image/).*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
