import type { Metadata } from "next";

import { PublicPage } from "@/components/shell/public-page";
import { SuggestionsPage } from "@/components/suggestions/suggestions-page";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Suggestions" };
export const dynamic = "force-dynamic";

/** Anyone can send a suggestion — no account needed. */
export default async function Suggestions() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <SuggestionsPage who={!user ? "visitor" : user.isGuest ? "guest" : "account"} />
      </div>
    </PublicPage>
  );
}
