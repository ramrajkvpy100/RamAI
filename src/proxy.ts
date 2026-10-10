import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy with a fresh nonce for every page: only RamAI's own
 * scripts — and the scripts they load, such as Razorpay's checkout — can run,
 * so injected markup can't execute code. Next.js reads the nonce from the
 * request header and stamps it on its own scripts.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    // React sets inline style attributes (gradients, animation timing); scripts stay locked down.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.razorpay.com",
    "font-src 'self' data:",
    `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON, and static files don't need a policy.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|\\.well-known).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
