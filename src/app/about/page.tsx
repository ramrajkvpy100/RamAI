import type { Metadata } from "next";

import { A, LegalPage, List, Section } from "@/components/legal/legal-page";
import { PublicPage } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "About", description: "RamAI is a clinical case simulator for doctors and medical students: real-feeling patients, hidden diagnoses, no hints." };
export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <PublicPage>
      <LegalPage
        eyebrow="About RamAI"
        title="Think like a doctor, every day."
        updated={false}
        intro="RamAI is a clinical case simulator for doctors and medical students. A patient walks in, calls, or is wheeled in — and you take it from there: no multiple choice, no hints, no diagnosis on the label."
      >
        <Section title="Why it exists">
          <p>
            Clinical judgement is built one patient at a time: asking the right question, noticing what's missing, choosing the test that changes
            management and treating before it's too late. Question banks test what you know. RamAI lets you practise what you do.
          </p>
        </Section>

        <Section title="How it works">
          <List>
            <li>
              <b className="text-fg">You lead the encounter in your own words.</b> Take a history, examine, order investigations, prescribe and
              advise — by typing or speaking, as you would at the bedside.
            </li>
            <li>
              <b className="text-fg">The patient responds realistically.</b> Vitals change on a live monitor, results take time, and wrong orders have
              consequences — with a window to rescue them.
            </li>
            <li>
              <b className="text-fg">Then the debrief.</b> The diagnosis, a score out of 100, what you did well, what you missed and why, and the
              teaching you need for next time.
            </li>
          </List>
        </Section>

        <Section title="Built for how medicine is practised">
          <List>
            <li>Three ways patients reach you: the clinic, the phone and the emergency department.</li>
            <li>Six care levels, from first-contact care to the hardest cases anywhere — each with the tests that facility really has.</li>
            <li>India, the USA or the UK: patients, places, drug names, units and prices follow the country you practise in.</li>
            <li>Streaks, ranks and weekly leagues, so a few cases a day becomes a habit.</li>
          </List>
        </Section>

        <Section title="What we promise">
          <List>
            <li>
              <b className="text-fg">Realism without spoilers.</b> Nothing on screen gives the answer away while the case is running.
            </li>
            <li>
              <b className="text-fg">Education, not advice.</b> Every patient is fictional, and RamAI is for learning — never for decisions about real
              patients. See the <A href="/disclaimer">disclaimer</A>.
            </li>
            <li>
              <b className="text-fg">Your data stays yours.</b> No ads, no trackers, and we never sell personal information. See the{" "}
              <A href="/privacy">privacy policy</A>.
            </li>
            <li>
              <b className="text-fg">Fair scores.</b> Every score is worked out on our servers, so leaderboards can't be gamed from a browser.
            </li>
          </List>
        </Section>

        <Section title="Talk to us">
          <p>
            Found a mistake in a case, have an idea, or want RamAI for your college or hospital? We'd love to hear from you — see{" "}
            <A href="/contact">Contact</A>.
          </p>
        </Section>
      </LegalPage>
    </PublicPage>
  );
}
