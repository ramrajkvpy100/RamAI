import type { Metadata } from "next";

import { OAuthCallback } from "@/components/auth/oauth-callback";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Signing you in", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/** Where Google sends the doctor back: the code is exchanged for a session (keeping a guest's cases), then on to where they were going. */
export default async function AuthCallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <OAuthCallback code={one(params.code)} next={safeNext(params.next)} failed={!!(one(params.error) ?? one(params.error_code))} />;
}
