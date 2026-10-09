import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  // Guests trying the demo can log in to an existing account instead.
  const user = await getCurrentUser();
  if (user && !user.isGuest) redirect(next);
  return <AuthForm mode="login" next={next} />;
}
