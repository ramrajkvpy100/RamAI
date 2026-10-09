import type { Metadata } from "next";

import { ResetForm } from "@/components/auth/reset-form";
import { resetLinkValid } from "@/server/account";

export const metadata: Metadata = { title: "Reset password", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  return <ResetForm token={token} valid={await resetLinkValid(token)} />;
}
