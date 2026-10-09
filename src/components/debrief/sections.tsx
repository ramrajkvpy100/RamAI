import { MediaFigure } from "@/components/media/media-figure";
import { Icon } from "@/components/ui/icon";
import { Badge, Label } from "@/components/ui/primitives";
import type { CaseDebrief, DrugMonograph, PracticalRoutine, SeverityBand } from "@/engine/types";
import { cn } from "@/lib/cn";
import { rupees } from "@/lib/format";

import { Bullets, Chain, Steps } from "./flow";

/* 01 ─ Diagnosis -------------------------------------------------------- */

export function DiagnosisSection({ d }: { d: CaseDebrief }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-1.5">Final diagnosis</Label>
        <p className="text-[17px] font-medium">{d.diagnosis}</p>
        {d.qualifier && <p className="mt-1 text-[14px] leading-6 text-fg-2">{d.qualifier}</p>}
      </div>
      <div>
        <Label className="mb-3">Why</Label>
        <ol className="flex flex-col">
          {d.reasoning.map((r, i) => (
            <li key={r.stage} className="relative grid grid-cols-[22px_1fr] gap-3 pb-4 last:pb-0">
              {i < d.reasoning.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[10.5px] w-px bg-line" />}
              <span className={cn("relative mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[10px]", i === d.reasoning.length - 1 ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-fg-2")}>
                {i === d.reasoning.length - 1 ? <Icon name="check" size={11} strokeWidth={2.2} /> : i + 1}
              </span>
              <div>
                <div className="micro mb-0.5 text-fg-3">{r.stage}</div>
                <p className="text-[14px] leading-6">{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* 03 ─ Misses ----------------------------------------------------------- */

export function MissesSection({ d }: { d: CaseDebrief }) {
  if (d.missed.length === 0) return <p className="text-[14px] text-fg-2">Nothing significant missed. That was a clean encounter.</p>;
  return (
    <div className="flex flex-col gap-3">
      {d.missed.map((m, i) => (
        <article key={i} className="overflow-hidden rounded-lg border border-line">
          <div className="flex items-center gap-2 border-b border-line-2 bg-surface-2 px-4 py-2">
            <Badge tone={m.severity === "major" ? "danger" : m.severity === "moderate" ? "warning" : "neutral"}>{m.severity}</Badge>
          </div>
          <div className="grid gap-px bg-line-2 sm:grid-cols-3">
            {[
              { label: "What you did", text: m.what },
              { label: "Why it matters", text: m.why },
              { label: "Better approach", text: m.better },
            ].map((col, ci) => (
              <div key={col.label} className="relative bg-surface px-4 py-3">
                <div className={cn("micro mb-1", ci === 2 ? "text-success" : "text-fg-3")}>{col.label}</div>
                <p className="text-[13.5px] leading-[1.6]">{col.text}</p>
                {ci < 2 && <Icon name="arrow-right" size={12} className="absolute top-3.5 -right-[7px] z-10 hidden rounded-full bg-surface text-fg-3 sm:block" />}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/* 04 ─ Decision tree ---------------------------------------------------- */

const ROWS: { key: keyof Pick<SeverityBand, "recognition" | "investigation" | "treatment" | "followUp">; label: string }[] = [
  { key: "recognition", label: "Recognition" },
  { key: "investigation", label: "Investigation" },
  { key: "treatment", label: "Treatment" },
  { key: "followUp", label: "Follow-up" },
];

export function DecisionTreeSection({ d }: { d: CaseDebrief }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] [&:hover]:[mask-image:none]">
        <div className="grid min-w-full auto-cols-[minmax(232px,1fr)] grid-flow-col gap-3">
          {d.severityBands.map((band) => {
            const current = band.id === d.patientBand;
            return (
              <section key={band.id} className={cn("flex flex-col rounded-lg border", current ? "border-accent-line bg-accent-soft/40" : "border-line bg-surface")}>
                <header className="flex items-center justify-between gap-2 border-b border-line-2 px-3.5 py-2.5">
                  <h4 className="text-[13.5px] font-medium">{band.label}</h4>
                  {current && <Badge tone="accent">This patient</Badge>}
                </header>
                <div className="flex flex-col">
                  {ROWS.map((row, ri) => (
                    <div key={row.key} className="relative px-3.5 py-2.5">
                      {ri > 0 && <Icon name="chevron-down" size={12} className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-fg-3" />}
                      <div className="micro mb-1 text-fg-3">{row.label}</div>
                      <ul className="flex flex-col gap-1">
                        {band[row.key].map((x, i) => (
                          <li key={i} className="text-[12.5px] leading-[1.55]">{x}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <div>
        <Label className="mb-3">Treatment failure</Label>
        <ol className="flex flex-wrap items-stretch gap-2">
          {d.treatmentFailure.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex max-w-[220px] items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] leading-[1.5]">
                <span className="micro mt-px text-fg-3 tabular">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </span>
              {i < d.treatmentFailure.steps.length - 1 && <Icon name="arrow-right" size={13} className="shrink-0 text-fg-3" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* 05 ─ Severity comparison --------------------------------------------- */

export function SeveritySection({ d }: { d: CaseDebrief }) {
  const bands = d.severityBands.filter((b) => b.media);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bands.map((b) => {
        const current = b.id === d.patientBand;
        return (
          <figure key={b.id} className={cn("flex flex-col overflow-hidden rounded-lg border", current ? "border-accent-line" : "border-line")}>
            <div className="relative">
              <MediaFigure media={b.media!} compact className="rounded-none border-0" />
              <span className="pointer-events-none absolute top-2 left-2">{current ? <Badge tone="accent">This patient</Badge> : null}</span>
            </div>
            <figcaption className="flex flex-col gap-2.5 border-t border-line-2 px-3.5 py-3">
              <div className="text-[13.5px] font-medium">{b.label}</div>
              <div>
                <div className="micro mb-0.5 text-fg-3">What you see</div>
                <p className="text-[12.5px] leading-[1.55] text-fg-2">{b.recognition.join(" · ")}</p>
              </div>
              <div>
                <div className="micro mb-0.5 text-fg-3">Treatment intensity</div>
                <p className="text-[12.5px] leading-[1.55] text-fg-2">{b.treatment[0]}</p>
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* 06 ─ Treatment -------------------------------------------------------- */

function Routine({ r }: { r: PracticalRoutine }) {
  return (
    <section className="rounded-lg border border-line">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <Icon name={/night/i.test(r.label) ? "moon" : /morning/i.test(r.label) ? "sun" : "clock"} size={14} className="text-fg-2" />
        <h4 className="micro text-fg">{r.label}</h4>
      </header>
      <ol className="flex flex-col gap-0 px-4 py-3">
        {r.steps.map((s, i) => (
          <li key={s.order} className="relative grid grid-cols-[22px_1fr] gap-3 pb-3 last:pb-0">
            {i < r.steps.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[10.5px] w-px bg-line-2" />}
            <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-surface-2 text-[10.5px] text-fg-2 tabular">{s.order}</span>
            <div>
              <p className="text-[14px] leading-6 font-medium">
                {s.step}
                {s.product && <span className="font-normal text-fg-2"> — {s.product}</span>}
              </p>
              {(s.howMuch || s.where) && (
                <p className="text-[12.5px] leading-5 text-fg-2">
                  {[s.howMuch && `How much: ${s.howMuch}`, s.where && `Where: ${s.where}`].filter(Boolean).join(" · ")}
                </p>
              )}
              {s.note && <p className="text-[12.5px] leading-5 text-fg-3">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      {(r.avoid?.length || r.expectedIrritation || r.ifIrritated || r.improvementTimeline) && (
        <dl className="grid gap-3 border-t border-line-2 px-4 py-3 sm:grid-cols-2">
          {r.avoid && r.avoid.length > 0 && (
            <div>
              <dt className="micro mb-1 text-fg-3">Avoid</dt>
              <dd><Bullets items={r.avoid} className="[&_li]:text-[12.5px] [&_li]:leading-5" /></dd>
            </div>
          )}
          {r.expectedIrritation && (
            <div>
              <dt className="micro mb-1 text-fg-3">Expected irritation</dt>
              <dd className="text-[12.5px] leading-5">{r.expectedIrritation}</dd>
            </div>
          )}
          {r.ifIrritated && (
            <div>
              <dt className="micro mb-1 text-fg-3">If irritation occurs</dt>
              <dd className="text-[12.5px] leading-5">{r.ifIrritated}</dd>
            </div>
          )}
          {r.improvementTimeline && (
            <div>
              <dt className="micro mb-1 text-fg-3">Expected improvement</dt>
              <dd className="text-[12.5px] leading-5">{r.improvementTimeline}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

export function TreatmentSection({ d }: { d: CaseDebrief }) {
  const band = d.severityBands.find((b) => b.id === d.patientBand);
  return (
    <div className="flex flex-col gap-5">
      {band && (
        <div>
          <Label className="mb-2">For this patient — {band.label.toLowerCase()}</Label>
          <Steps steps={band.treatment} tone="accent" />
        </div>
      )}
      {d.routines.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {d.routines.map((r) => (
            <Routine key={r.label} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* 07 ─ Drugs ------------------------------------------------------------ */

function Monograph({ m }: { m: DrugMonograph }) {
  return (
    <article className="overflow-hidden rounded-lg border border-line">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-2 px-4 py-3">
        <div>
          <h4 className="text-[14.5px] font-medium">{m.generic}</h4>
          {m.brand && <p className="text-[12.5px] text-fg-2">{m.brand}</p>}
        </div>
        <p className="text-[12.5px] text-fg-2 tabular">
          {m.dose} · {m.route} · {m.frequency}
        </p>
      </header>
      <dl className="grid gap-x-6 gap-y-3.5 px-4 py-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="micro mb-0.5 text-fg-3">Indication · Duration</dt>
          <dd className="text-[13.5px] leading-6">
            {m.indication} <span className="text-fg-3">·</span> {m.duration}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="micro mb-1 text-fg-3">Mechanism</dt>
          <dd><Chain text={m.mechanism} className="[&_li]:text-[13.5px]" /></dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="micro mb-0.5 text-fg-3">Why it works</dt>
          <dd className="text-[13.5px] leading-6">{m.whyItWorks}</dd>
        </div>
        <div>
          <dt className="micro mb-1 text-fg-3">When not to use</dt>
          <dd><Bullets items={m.avoidWhen} className="[&_li]:text-[13px] [&_li]:leading-[1.55]" /></dd>
        </div>
        <div>
          <dt className="micro mb-1 text-fg-3">Adverse effects</dt>
          <dd><Bullets items={m.adverseEffects} className="[&_li]:text-[13px] [&_li]:leading-[1.55]" /></dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="micro mb-1 text-fg-3">Monitoring</dt>
          <dd><Bullets items={m.monitoring} className="[&_li]:text-[13px] [&_li]:leading-[1.55]" /></dd>
        </div>
      </dl>
    </article>
  );
}

export function DrugsSection({ d }: { d: CaseDebrief }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {d.drugs.map((m) => (
        <Monograph key={m.generic} m={m} />
      ))}
    </div>
  );
}

/* 08 ─ Investigations --------------------------------------------------- */

const PRIORITY_TONE = { essential: "accent", useful: "success", situational: "neutral", unnecessary: "danger" } as const;

export function InvestigationsSection({ d }: { d: CaseDebrief }) {
  const ordered = new Set(d.orderedInvestigationIds);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-fg-2 tabular">You spent {rupees(d.spend)} on investigations.</p>
      <div className="overflow-hidden rounded-lg border border-line">
        <ul className="divide-y divide-line-2">
          {d.investigations.map((inv) => {
            const did = !!inv.id && ordered.has(inv.id);
            return (
              <li key={inv.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,200px)_1fr_auto] sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium">{inv.name}</span>
                  {did && <Icon name="check" size={13} className="text-fg-2" label="You ordered this" />}
                </div>
                <div className="text-[12.5px] leading-[1.55] text-fg-2">
                  <p>{inv.whenToOrder}</p>
                  <p className="text-fg-3">{inv.whatItTellsYou}</p>
                </div>
                <div className="flex items-start gap-2 sm:flex-col sm:items-end">
                  <Badge tone={PRIORITY_TONE[inv.priority]}>{inv.priority}</Badge>
                  {inv.cost ? <span className="text-[11.5px] text-fg-3 tabular">{rupees(inv.cost)}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* 09 ─ Rescue ----------------------------------------------------------- */

export function RescueSection({ d }: { d: CaseDebrief }) {
  if (!d.rescue.occurred) {
    const c = d.rescue.counterfactual;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-fg-2">No deterioration occurred during this encounter.</p>
        {c && (
          <div className="rounded-lg border border-line bg-surface-2 px-4 py-3.5">
            <div className="micro mb-1 text-fg-3">{c.title}</div>
            <p className="mb-3 text-[14px] leading-6">{c.body}</p>
            <Steps steps={c.sequence} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {d.rescue.episodes.map((e, i) => (
        <article key={i} className="overflow-hidden rounded-lg border border-line">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 bg-surface-2 px-4 py-2.5">
            <h4 className="text-[14px] font-medium">{e.label}</h4>
            <Badge tone={e.rescued === "full" ? "success" : e.rescued === "partial" ? "warning" : e.rescued === "not-applicable" ? "neutral" : "danger"}>
              {e.rescued === "full" ? "Rescued" : e.rescued === "partial" ? "Rescued late" : e.rescued === "not-applicable" ? "After discharge" : "Not rescued"}
            </Badge>
          </header>
          <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2">
            <div>
              <dt className="micro mb-0.5 text-fg-3">Cause of deterioration</dt>
              <dd className="text-[13.5px] leading-6">{e.cause}</dd>
            </div>
            <div>
              <dt className="micro mb-0.5 text-fg-3">What you did</dt>
              <dd className="text-[13.5px] leading-6">{e.whatYouDid}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="micro mb-1 text-fg-3">Why it caused harm</dt>
              <dd><Chain text={e.whyItCausedHarm.replace(/ → /g, " → ")} className="[&_li]:text-[13.5px]" /></dd>
            </div>
            <div>
              <dt className="micro mb-0.5 text-fg-3">Earliest rescue window</dt>
              <dd className="text-[13.5px] leading-6">{e.earliestRescueWindow}</dd>
            </div>
            <div>
              <dt className="micro mb-0.5 text-fg-3">Last realistic rescue window</dt>
              <dd className="text-[13.5px] leading-6">{e.lastRealisticRescueWindow}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="micro mb-2 text-fg-3">Correct rescue sequence</dt>
              <dd><Steps steps={e.correctRescueSequence} tone="accent" /></dd>
            </div>
            {e.yourResponse.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="micro mb-1 text-fg-3">Your response</dt>
                <dd><Bullets items={e.yourResponse} className="[&_li]:text-[13px]" /></dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="micro mb-0.5 text-fg-3">Outcome</dt>
              <dd className="text-[14px] font-medium">{e.outcome}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

/* 10 ─ Follow-up -------------------------------------------------------- */

export function FollowUpSection({ d }: { d: CaseDebrief }) {
  const f = d.followUp;
  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <dt className="micro mb-0.5 text-fg-3">Review</dt>
        <dd className="text-[15px] font-medium">{f.interval}</dd>
      </div>
      <div>
        <dt className="micro mb-1.5 text-fg-3">Reassess</dt>
        <dd><Bullets items={f.reassess} /></dd>
      </div>
      <div>
        <dt className="micro mb-1.5 text-fg-3">Red flags — return immediately</dt>
        <dd><Bullets items={f.redFlags} marker="alert" /></dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="micro mb-1.5 text-fg-3">When to escalate</dt>
        <dd><Steps steps={f.whenToEscalate} numbered={false} /></dd>
      </div>
    </dl>
  );
}
