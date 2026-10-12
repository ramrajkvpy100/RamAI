import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth";
import { authProviders } from "@/server/supabase";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  // Guests trying the demo can log in to an existing account instead.
  const user = await getCurrentUser();
  if (user && !user.isGuest) redirect(next);
  const { google } = await authProviders();
  const error = params.error === "google" ? "Google sign-in didn't start. Please try again, or use your email." : params.error === "google-off" ? "Google sign-in isn't switched on yet — use your email for now." : null;
  return <AuthForm mode="login" next={next} google={google} error={error} />;
}
