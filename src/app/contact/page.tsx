import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";
import { phoneDigits, SITE, whatsappLink } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "How to reach RamAI for support, refunds, privacy requests and feedback." };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <PublicPage>
      <LegalPage
        eyebrow="Contact"
        title="We're here to help."
        updated={false}
        intro={
          <>
            Email us at <Email />
            {whatsappLink() && (
              <>
                {" "}or message us on <A href={whatsappLink()!}>WhatsApp</A>
              </>
            )}{" "}
            — we reply within {SITE.replyWithin}.
          </>
        }
      >
        <Section title="Write to us about">
          <List>
            <li>
              <b className="text-fg">Your account or a problem using RamAI</b> — tell us the email you signed up with and what happened.
            </li>
            <li>
              <b className="text-fg">A payment or refund</b> — include your Razorpay payment ID (it's in your payment confirmation).
            </li>
            <li>
              <b className="text-fg">Your data</b> — to see, correct or delete your account and data, write from the email address on your account.
            </li>
            <li>
              <b className="text-fg">A mistake in a case</b> — the case number (e.g. CASE 012) and what looked wrong. Clinical corrections are always
              welcome.
            </li>
            <li>
              <b className="text-fg">Colleges, hospitals and partnerships</b> — tell us about your learners and what you need.
            </li>
          </List>
        </Section>

        <Section title="Grievance officer">
          <p>
            Complaints about RamAI, including privacy concerns, can be sent to our grievance officer{SITE.owner ? `, ${SITE.owner},` : ""} at <Email />.
            We acknowledge complaints within {SITE.replyWithin} and aim to resolve them within 15 days.
          </p>
        </Section>

        {(SITE.owner || SITE.phone || SITE.address) && (
          <Section title="Business details">
            <List>
              {SITE.owner && <li>RamAI is run by {SITE.owner}</li>}
              <li>
                Email: <Email />
              </li>
              {SITE.phone && (
                <li>
                  Phone{SITE.whatsapp ? " & WhatsApp" : ""}: <A href={`tel:${phoneDigits()}`}>{SITE.phone}</A>
                  {whatsappLink() && (
                    <>
                      {" "}· <A href={whatsappLink()!}>Chat on WhatsApp</A>
                    </>
                  )}
                </li>
              )}
              {SITE.address && <li>Address: {SITE.address}</li>}
            </List>
          </Section>
        )}

        <Section title="In a medical emergency">
          <p>
            RamAI cannot help with real patients. Call your local emergency number — 108 or 112 in India, 911 in the USA, 999 in the UK — or go to
            the nearest emergency department.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
