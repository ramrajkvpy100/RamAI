import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";
import { operator, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy", description: "What RamAI collects, why, who helps us run it, and your rights." };
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <PublicPage>
      <LegalPage
        eyebrow="Privacy policy"
        title="Your data, plainly."
        intro={`This policy explains what ${operator()} ("RamAI", "we") collects when you use RamAI, why, who helps us run it, and the choices and rights you have. We collect as little as we can, we never sell your data, and we don't show ads or use tracking tools.`}
      >
        <Section title="What we collect">
          <List>
            <li>
              <b className="text-fg">Your account:</b> name, username, email address and your password — stored only as a secure one-way hash, never
              in readable form. Also your country and patient-language preference, plan, and whether your email is verified.
            </li>
            <li>
              <b className="text-fg">Your progress:</b> for each case you finish — the case, its specialty, mode and level, your score, XP and the
              time — plus when you start cases (for daily limits), your streak and your weekly league.
            </li>
            <li>
              <b className="text-fg">What you do inside a case:</b> while a case runs, the actions you type are kept in an encrypted token in your
              browser, so the case can continue. We keep only the result once the case ends, not a transcript.
            </li>
            <li>
              <b className="text-fg">Payments:</b> the plan, amount, date and the order and payment IDs from Razorpay. Your card, UPI or bank
              details go to Razorpay, not to us.
            </li>
            <li>
              <b className="text-fg">Technical data:</b> your IP address is used briefly to stop abuse (such as too many sign-in attempts), and our
              hosting provider keeps standard server logs.
            </li>
          </List>
          <p>
            If you try the demo without an account, we create a temporary guest account. It's deleted after 7 days unless you sign up, when your
            demo case moves into your new account.
          </p>
        </Section>

        <Section title="Why we use it">
          <List>
            <li>To run your account and RamAI's features: cases, debriefs, progress, streaks, leaderboards and leagues.</li>
            <li>To process payments and give you the plan you paid for.</li>
            <li>To send emails you need: verifying your address and resetting your password. We don't send marketing emails.</li>
            <li>To keep RamAI secure and working, and to fix problems.</li>
          </List>
          <p>
            Leaderboards and leagues show your name, username, XP, rank and number of cases to other players. Your email address is never shown to
            anyone.
          </p>
        </Section>

        <Section title="Cookies and browser storage">
          <p>
            We use one essential cookie that keeps you signed in for up to 30 days. Your browser also stores a few settings on your device — theme,
            sound, tips you've dismissed — and the case you're playing. There are no advertising or analytics cookies, so there's nothing to opt out
            of.
          </p>
        </Section>

        <Section title="Who helps us run RamAI">
          <p>We share only what each service needs to do its job, under their own privacy and security commitments:</p>
          <List>
            <li>
              <b className="text-fg">Vercel</b> — hosts the website and app.
            </li>
            <li>
              <b className="text-fg">Turso</b> — stores the database.
            </li>
            <li>
              <b className="text-fg">Razorpay</b> — processes payments.
            </li>
            <li>
              <b className="text-fg">Resend</b> — delivers account emails, once email is switched on.
            </li>
            <li>
              <b className="text-fg">OpenAI</b> — only if AI features are switched on: the text you type during a case and the case's details are
              sent to understand it and reply. Your name and email are not sent, and under OpenAI's terms for this service the data isn't used to
              train their models.
            </li>
          </List>
          <p>
            These providers may process data outside your country, including in the United States. We don't sell or rent personal information, and
            we only disclose it if the law requires us to.
          </p>
        </Section>

        <Section title="How long we keep it">
          <List>
            <li>Your account and progress: for as long as you have an account.</li>
            <li>Guest accounts: 7 days.</li>
            <li>Sign-in sessions: up to 30 days. Email links: until they expire (48 hours to verify, 1 hour to reset a password).</li>
            <li>Payment records: as long as tax and accounting law requires.</li>
          </List>
          <p>When you delete your account, we delete your data within 30 days, except records we must keep by law.</p>
        </Section>

        <Section title="Keeping it safe">
          <p>
            Passwords and sign-in tokens are stored only as secure hashes, everything travels over encrypted connections, case sessions are
            encrypted, and access to the database is restricted. No system is perfectly secure, but we work to protect your data and will tell you
            promptly if a breach affects you.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Wherever you live, you can ask us to see the data we hold about you, correct it, delete your account, or withdraw consent. Write to{" "}
            <Email /> from the email address on your account and we'll respond within 30 days.
          </p>
          <List>
            <li>
              <b className="text-fg">India:</b> you have the rights given by the Digital Personal Data Protection Act, 2023, including grievance
              redressal and nominating someone to exercise your rights. Our grievance contact is on the <A href="/contact">Contact</A> page.
            </li>
            <li>
              <b className="text-fg">UK and EU:</b> we use your data to provide the service you signed up for (contract) and to keep it secure
              (legitimate interests). You may also object, restrict processing, take your data with you, and complain to your data-protection
              authority — in the UK, the Information Commissioner's Office.
            </li>
            <li>
              <b className="text-fg">USA:</b> we don't sell or share personal information for advertising. California residents can ask to know,
              correct or delete their data.
            </li>
          </List>
        </Section>

        <Section title="Children">
          <p>RamAI is for doctors, medical students and healthcare learners aged 18 or over. We don't knowingly collect data from children.</p>
        </Section>

        <Section title="Changes">
          <p>
            If we change this policy, we'll update the date above. If the change matters, we'll let you know in the app or by email before it takes
            effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests about your data: <Email />. We reply within {SITE.replyWithin}.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
