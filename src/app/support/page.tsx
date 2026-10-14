import type { Metadata } from "next";

import { PublicPage } from "@/components/shell/public-page";
import { Donate } from "@/components/support/donate";
import { SITE } from "@/lib/site";
import { getCurrentUser } from "@/server/auth";
import { billingStatus } from "@/server/billing";

export const metadata: Metadata = { title: "Support RamAI", description: "Help keep RamAI running — give any amount from ₹10." };
export const dynamic = "force-dynamic";

/** Anyone can give — no account needed. */
export default async function Support() {
  const user = await getCurrentUser().catch(() => null);
  const billing = billingStatus();
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-2xl">
        <section className="panel p-5 sm:p-7" aria-labelledby="support-heading">
          <h1 id="support-heading" className="text-[26px] font-semibold tracking-[-0.02em]">
            Support RamAI
          </h1>
          <p className="mt-1.5 mb-6 text-[14.5px] leading-6 text-fg-2">
            RamAI is built by one doctor{SITE.owner ? ` — ${SITE.owner}` : ""}. Every case the AI writes and every picture costs real money. If RamAI has helped you learn, a small gift keeps it going.
          </p>
          <Donate available={billing.available} testMode={billing.mode === "test"} name={user && !user.isGuest ? user.name : undefined} />
        </section>
      </div>
    </PublicPage>
  );
}
