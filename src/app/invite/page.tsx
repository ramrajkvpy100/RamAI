import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Join RamAI", robots: { index: false, follow: false } };

/** A colleague's invite link. Nobody needs one to get in now; it only says who invited them, for the reward ladder (RefCapture keeps ?ref=). */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ ref?: string; next?: string }> }) {
  const { ref, next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/signup";
  const name = ref && /^[a-z0-9_.-]{2,40}$/i.test(ref) ? ref : null;
  redirect(name ? `${safe}${safe.includes("?") ? "&" : "?"}ref=${encodeURIComponent(name)}` : safe);
}
