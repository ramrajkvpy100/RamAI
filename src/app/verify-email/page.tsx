import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyForm } from "@/components/auth/verify-form";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Verify your email", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const linkCode = one(params.code);
  // Already signed in to a verified account: nothing to do here.
  const user = await getCurrentUser().catch(() => null);
  if (user && !user.isGuest && !linkCode) redirect("/");
  return <VerifyForm linkCode={linkCode} linkError={!!(one(params.error_code) ?? one(params.error))} />;
}
