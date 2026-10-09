import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";
import { PRICES } from "@/lib/plans";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund & cancellation policy", description: "RamAI Pro comes with a 7-day money-back guarantee." };
export const dynamic = "force-dynamic";

export default function RefundPolicyPage() {
  return (
    <PublicPage>
      <LegalPage
        eyebrow="Refund & cancellation policy"
        title="7-day money-back guarantee."
        intro="If RamAI Pro isn't right for you, ask within 7 days of paying and we'll refund you in full — no questions asked."
      >
        <Section title="How Pro is sold">
          <p>
            Pro is a one-time payment — {PRICES.monthly.label} for {PRICES.monthly.days} days or {PRICES.yearly.label} for {PRICES.yearly.days} days.
            It never renews on its own, so you're never charged again unless you choose to buy another period.
          </p>
        </Section>

        <Section title="Full refund within 7 days">
          <List>
            <li>Ask within 7 days of a payment and we'll refund that payment in full.</li>
            <li>Pro ends for that period once the refund is made; your account, progress and free plan stay.</li>
            <li>We may decline repeated refund requests that look like misuse of the guarantee.</li>
          </List>
        </Section>

        <Section title="After 7 days">
          <p>Payments are final after 7 days, and unused days aren't refunded. We always refund in full, whenever you notice:</p>
          <List>
            <li>a duplicate charge for the same purchase;</li>
            <li>a payment that went through but didn't activate Pro (if we can't fix it quickly).</li>
          </List>
        </Section>

        <Section title="How to ask for a refund">
          <p>
            Email <Email /> from the address on your account and include your Razorpay payment ID. We'll confirm within {SITE.replyWithin}.
          </p>
          <p>
            Approved refunds are sent back to your original payment method through Razorpay. Banks usually show them within 5–7 working days.
          </p>
        </Section>

        <Section title="Cancellation">
          <p>
            As there's no subscription, there's nothing to cancel: Pro simply ends when your period does, and you carry on with the free plan. To
            close your account altogether, see the <A href="/privacy">privacy policy</A>.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
