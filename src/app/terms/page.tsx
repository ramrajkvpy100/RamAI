import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";
import { PLANS, PRICES } from "@/lib/plans";
import { operator } from "@/lib/site";

export const metadata: Metadata = { title: "Terms & conditions", description: "The terms for using RamAI, including accounts, Pro plans and acceptable use." };
export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <PublicPage>
      <LegalPage
        eyebrow="Terms & conditions"
        title="The terms for using RamAI."
        intro={`These terms are an agreement between you and ${operator()} ("RamAI", "we"). By creating an account, trying the demo or buying Pro, you accept them. If you don't agree, please don't use RamAI.`}
      >
        <Section title="1. Who can use RamAI">
          <p>
            RamAI is an educational simulation for doctors, medical students and other healthcare learners. You must be 18 or older and able to
            enter into this agreement.
          </p>
        </Section>

        <Section title="2. Education only — not medical advice">
          <p>
            Cases are fictional and content is for learning. Never use RamAI to make decisions about real patients. The{" "}
            <A href="/disclaimer">disclaimer</A> is part of these terms.
          </p>
        </Section>

        <Section title="3. Your account">
          <List>
            <li>Give accurate details and keep your password private. You're responsible for what happens in your account.</li>
            <li>One person per account. Don't share or sell accounts.</li>
            <li>Your name and username appear on leaderboards; pick ones that aren't offensive or misleading.</li>
            <li>A guest account from the demo is temporary and is deleted after 7 days unless you sign up.</li>
          </List>
        </Section>

        <Section title="4. Fair use">
          <p>Please don't:</p>
          <List>
            <li>use bots, scripts or automation to play cases, or manipulate scores, streaks, leaderboards or leagues;</li>
            <li>copy, scrape, resell or republish cases or teaching content;</li>
            <li>try to get around plan limits, reverse-engineer the service or interfere with its security or availability;</li>
            <li>use RamAI for anything unlawful or to harm others.</li>
          </List>
          <p>We may remove scores, reset rankings, or suspend or close accounts that break these rules.</p>
        </Section>

        <Section title="5. Plans and payments">
          <List>
            <li>
              <b className="text-fg">Free:</b> {PLANS.free.dailyCases} cases a day on the first three care levels.
            </li>
            <li>
              <b className="text-fg">Pro:</b> unlimited cases at every level — {PRICES.monthly.label} for {PRICES.monthly.days} days or{" "}
              {PRICES.yearly.label} for {PRICES.yearly.days} days.
            </li>
            <li>Pro is a one-time payment for a fixed period. It does not renew automatically, so there's nothing to cancel.</li>
            <li>Prices are in Indian rupees. Payments are processed by Razorpay; any taxes that apply are shown at checkout.</li>
            <li>We may change prices or features in future. Changes never affect a period you've already paid for.</li>
            <li>
              Refunds follow our <A href="/refund-policy">refund policy</A> — including a 7-day money-back guarantee.
            </li>
          </List>
        </Section>

        <Section title="6. Our content">
          <p>
            Cases, text, images, software and the RamAI name belong to RamAI. We give you a personal, non-transferable licence to use them for your
            own learning. If you send us feedback or suggestions, we may use them freely.
          </p>
        </Section>

        <Section title="7. Availability and changes">
          <p>
            We work to keep RamAI running and accurate, but it's provided "as is" and "as available": it may sometimes be unavailable, change, or
            contain errors. We may add, change or remove features and cases.
          </p>
        </Section>

        <Section title="8. Liability">
          <p>
            To the extent the law allows, RamAI isn't liable for indirect or consequential loss, or for any decision made using its content. Our
            total liability for any claim is limited to the amount you paid us in the 12 months before it arose. Nothing in these terms limits
            rights you have under consumer-protection law that can't be excluded.
          </p>
        </Section>

        <Section title="9. Ending your account">
          <p>
            You can stop using RamAI at any time, and ask us to delete your account by writing to <Email />. We may suspend or close accounts that
            break these terms, telling you why where we reasonably can.
          </p>
        </Section>

        <Section title="10. Law and disputes">
          <p>
            These terms are governed by the laws of India, and the courts of India have jurisdiction over disputes. If you're a consumer elsewhere,
            you also keep the protections of your local law. Please contact us first — most problems are quick to solve.
          </p>
        </Section>

        <Section title="11. Changes to these terms">
          <p>
            We'll update the date above when these terms change, and tell you in advance if a change significantly affects you. Using RamAI after a
            change means you accept the new terms.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Questions about these terms: <Email />.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
