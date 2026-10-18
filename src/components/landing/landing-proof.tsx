import { Icon, type IconName } from "@/components/ui/icon";

export interface SiteStats {
  drugs: number;
  tests: number;
  specialties: number;
  countries: number;
  levels: number;
}

/** What a finished case gives back: a sample debrief (an illustration, not a real player's). */
export function SampleDebrief() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="proof-heading">
      <p className="text-[12px] font-semibold tracking-[0.16em] text-accent-text uppercase">After every case</p>
      <h2 id="proof-heading" className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[38px]">A debrief that tells you exactly what to fix.</h2>
      <div className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card flex flex-col items-center justify-center gap-1 p-6 text-center">
          <span className="text-[12px] font-semibold tracking-[0.12em] text-fg-3 uppercase">Sample score</span>
          <span className="text-[64px] leading-none font-bold tabular">78</span>
          <span className="text-[13px] text-fg-2">Dengue with warning signs · OPD · District</span>
          <div className="mt-3 grid w-full grid-cols-3 gap-2 text-[12px]">
            {[["History", "9/10"], ["Work-up", "7/10"], ["Treatment", "8/10"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface-2 py-2"><div className="font-semibold tabular">{v}</div><div className="text-fg-3">{k}</div></div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-[13px] font-semibold text-success">✓ What you did well</div>
          <p className="mt-1 text-[14px] leading-6 text-fg-2">Asked about bleeding and abdominal pain early; checked the haematocrit before fluids.</p>
          <div className="mt-4 text-[13px] font-semibold text-amber-600 dark:text-amber-400">! What you missed</div>
          <p className="mt-1 text-[14px] leading-6 text-fg-2">Didn&apos;t check a postural BP. <span className="text-fg-3">Why it matters: postural drop is an early sign of plasma leakage (WHO dengue guidelines).</span></p>
          <div className="mt-4 text-[13px] font-semibold text-accent-text">→ The ideal approach</div>
          <p className="mt-1 text-[14px] leading-6 text-fg-2">Warning signs present → admit, crystalloid by haematocrit, platelets and haematocrit every 6 hours, no NSAIDs.</p>
          <p className="mt-4 text-[11.5px] text-fg-3">A sample debrief, written to illustrate — not a real player&apos;s result.</p>
        </div>
      </div>
    </section>
  );
}

/** The numbers behind it, counted from the simulator itself. */
export function Numbers({ stats }: { stats: SiteStats }) {
  const items: [string, string][] = [
    ["Unlimited", "new patients, invented for you"],
    [String(stats.specialties), "specialties"],
    [String(stats.levels), "hospital levels, PHC to rare & complex"],
    [String(stats.drugs), "drugs with real doses"],
    [String(stats.tests), "tests with real results and prices"],
    [String(stats.countries), "countries: India, USA, UK"],
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6" aria-label="RamAI in numbers">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(([n, label]) => (
          <div key={label} className="card p-4 text-center">
            <div className="text-[24px] font-bold tracking-[-0.02em] tabular">{n}</div>
            <div className="mt-0.5 text-[12px] leading-5 text-fg-2">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Who built it, and how the medicine is kept right. */
export function Trust() {
  const points: [IconName, string, string][] = [
    ["user", "Built by an MBBS doctor", "Made by a practising doctor, for doctors and students."],
    ["book", "Follows the standard references", "Cases follow standard textbooks and guidelines — WHO, ICMR, NICE and AHA where they apply."],
    ["shield", "Checked before you see it", "Every invented case is checked by a second, independent AI review against its own case file; results and replies come from that file."],
    ["alert", "Spot an error? Report it", "Every case has a Report button. Reported cases are reviewed every week."],
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="trust-heading">
      <p className="text-[12px] font-semibold tracking-[0.16em] text-accent-text uppercase">Trust</p>
      <h2 id="trust-heading" className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[38px]">Medicine you can rely on.</h2>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {points.map(([icon, title, body]) => (
          <div key={title} className="card flex gap-3.5 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon name={icon} size={18} /></span>
            <div>
              <div className="text-[15px] font-semibold">{title}</div>
              <p className="mt-1 text-[14px] leading-6 text-fg-2">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ["Is this medical advice?", "No. RamAI is an educational simulation for doctors and medical students. The patients are fictional; never use it to make decisions about a real patient."],
  ["How are cases made?", "A few are written by hand. Most are invented on demand by an AI model from a case blueprint — the hidden diagnosis, history, findings, results and ideal management — and the simulator plays the patient strictly from that blueprint."],
  ["Are they clinician-reviewed?", "Each invented case is checked automatically by a second AI review before you see it, and the scoring is done by fixed rules, not the AI. Reported cases are reviewed by a doctor every week."],
  ["Is my data safe?", "Sign-in is handled by Supabase; we never store your password. Your cases and progress are private to your account, and you can export or delete your data from your profile at any time."],
  ["Is it free?", "Yes — 5 cases a day free, the daily case and the demo. Pro gives unlimited cases and every level."],
];

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[34px]">Questions</h2>
      <div className="mt-6 flex flex-col gap-2.5">
        {FAQS.map(([q, a]) => (
          <details key={q} className="card group p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-medium">
              {q}
              <Icon name="chevron-down" size={16} className="text-fg-3 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-4 text-[14px] leading-6 text-fg-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
