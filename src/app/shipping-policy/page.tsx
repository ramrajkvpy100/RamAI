import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "Shipping & delivery policy", description: "RamAI is a digital service: Pro is delivered instantly online." };
export const dynamic = "force-dynamic";

export default function ShippingPolicyPage() {
  return (
    <PublicPage>
      <LegalPage eyebrow="Shipping & delivery policy" title="Delivered instantly, online." intro="RamAI is a digital service. Nothing is shipped to you.">
        <Section title="Delivery">
          <List>
            <li>RamAI Pro is activated on your account as soon as your payment is confirmed — usually within seconds.</li>
            <li>You'll see Pro on your account straight away, on any device where you sign in.</li>
            <li>There are no delivery charges, and RamAI works anywhere you can open the website.</li>
          </List>
        </Section>

        <Section title="If something goes wrong">
          <p>
            If you've paid but Pro hasn't activated within 24 hours, email <Email /> with your Razorpay payment ID. We'll activate it, or refund you
            in full under our <A href="/refund-policy">refund policy</A>.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
