import type { Metadata } from "next";

import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Reset password", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" && v.length <= 500 ? v : null);

/** The reset link lands here: ?token_hash=…&type=recovery (RamAI's email template) or ?code=… (Supabase's default). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const type = one(params.type);
  const tokenHash = one(params.token_hash) && (!type || type === "recovery") ? one(params.token_hash) : null;
  return <ResetForm tokenHash={tokenHash} code={one(params.code)} linkError={!!(one(params.error_code) ?? one(params.error))} />;
}
