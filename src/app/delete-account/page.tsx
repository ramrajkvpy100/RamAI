import type { Metadata } from "next";

import { A, Email, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "Delete your account", description: "How to delete your RamAI account and data — in the app or on the website, or by email." };
export const dynamic = "force-dynamic";

/** Anyone can read how to delete their account (Google Play links here from the app's listing). */
export default function DeleteAccountPage() {
  return (
    <PublicPage>
      <LegalPage eyebrow="Your account" title="Delete your RamAI account." intro="You can delete your account and data yourself at any time, on the website or in the Android app. It takes a moment and can't be undone.">
        <Section title="Delete it yourself">
          <List>
            <li>Sign in, open your <A href="/profile">Profile</A>, and press <b className="text-fg">Delete account</b>. Confirm with your password.</li>
            <li>Want a copy first? On the same page, <b className="text-fg">Download my data</b> gives you everything we hold.</li>
          </List>
        </Section>
        <Section title="Or ask us">
          <p>
            Can&apos;t sign in? Write to <Email /> from the email address on your account, asking us to delete it. We&apos;ll confirm and delete it
            within 30 days.
          </p>
        </Section>
        <Section title="What is deleted">
          <List>
            <li>Your account: name, username, email address and sign-in.</li>
            <li>Your progress: cases played, scores, XP, streaks, leagues, reports and answers.</li>
            <li>Your posts, replies and likes in the community, and your suggestions.</li>
            <li>Reminder subscriptions and any saved cases.</li>
          </List>
        </Section>
        <Section title="What we keep">
          <p>
            Only what the law requires: for any payment, its amount, date, period and payment IDs — with nothing that identifies you — for as long
            as tax law requires. See the <A href="/privacy">privacy policy</A>.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
