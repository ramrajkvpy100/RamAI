import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";
import { FAQ } from "@/lib/faq";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ — clinical case simulator for doctors and medical students",
  description: "What RamAI is, who it's for, what it costs, the Android app, Skills Lab, NEET PG and USMLE practice, and how cases are scored.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <PublicPage>
      <JsonLd faq />
      <LegalPage eyebrow="Questions" title="Frequently asked questions" updated={false} intro="Short answers about RamAI, the clinical case simulator.">
        {FAQ.map(([q, a]) => (
          <Section key={q} title={q}>
            <p>{a}</p>
          </Section>
        ))}
      </LegalPage>
    </PublicPage>
  );
}
