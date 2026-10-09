import type { Metadata } from "next";

import { VerifyResult } from "@/components/auth/verify-result";
import { confirmEmail } from "@/server/account";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Verify email", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const firstName = (name: string) => name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0];

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const verified = typeof raw === "string" ? await confirmEmail(raw) : null;
  if (verified) return <VerifyResult verified name={firstName(verified.name)} canResend={false} />;
  // An already-verified account opening an old link is still verified.
  const user = await getCurrentUser();
  if (user?.emailVerified) return <VerifyResult verified name={firstName(user.name)} canResend={false} />;
  return <VerifyResult verified={false} canResend={!!user && !user.isGuest} />;
}
