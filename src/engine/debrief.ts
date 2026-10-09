/**
 * Debrief generation — released only after closure.
 *
 * Combines the case's static teaching content with what the player actually
 * did: strengths, misses (what you did → why it was wrong → better approach),
 * rescue episodes, and the score.
 */

import { catalogInvestigation } from "./catalog";
import type { ClinicalCaseDefinition } from "./case-definition";
import { hazardLibrary } from "./physiology";
import { calculateScore, diagnosisVerdict } from "./scoring";
import type { HiddenState } from "./simulator";
import { describeSpan } from "./text";
import type { CaseDebrief, CaseState, DebriefMiss, InvestigationTeaching, RescueEpisode } from "./types";

const SEVERITY_ORDER = { major: 0, moderate: 1, minor: 2 } as const;

export function generateDebrief(def: ClinicalCaseDefinition, hidden: HiddenState, state: CaseState): CaseDebrief {
  const score = calculateScore(def, hidden);
  const verdict = diagnosisVerdict(def, hidden);
  const ordered = new Set(hidden.investigations.map((i) => i.defId));
  const did = (id: string) => (hidden.actions[id]?.length ?? 0) > 0;
  const lib = hazardLibrary(def);

  /* Strengths ----------------------------------------------------------- */
  const didWell: string[] = [];
  const strengths = def.rubric.strengths;
  for (const h of def.history) if (hidden.history[h.id] !== undefined && strengths[h.id]) didWell.push(strengths[h.id]!);
  for (const e of def.exam) if (hidden.exams[e.id] !== undefined && strengths[e.id]) didWell.push(strengths[e.id]!);
  for (const i of def.investigations) if (ordered.has(i.id) && strengths[i.id]) didWell.push(strengths[i.id]!);
  for (const r of def.therapeutics) {
    if (!did(r.id)) continue;
    if (strengths[r.id]) didWell.push(strengths[r.id]!);
    else if (r.praise) didWell.push(r.praise);
  }
  if (verdict === "correct") didWell.unshift("Reached the correct diagnosis.");
  else if (verdict === "implied") didWell.unshift("Your management showed you recognised the diagnosis.");
  const allergy = def.history.find((h) => h.group === "allergy");
  const firstDrug = hidden.drugs[0];
  if (allergy && firstDrug && hidden.history[allergy.id] !== undefined && hidden.history[allergy.id]! <= firstDrug.at) {
    didWell.push("Asked about allergies before prescribing.");
  }
  for (const h of hidden.hazards) {
    if (h.rescue === "full" && h.manifestedAt !== undefined) didWell.push(`Recognised the deterioration and rescued it within the window (${h.label.toLowerCase()}).`);
  }
  if (score.bonuses.some((b) => b.label === "Cost-effective work-up")) didWell.push("Kept the work-up focused and cost-effective.");

  /* Misses -------------------------------------------------------------- */
  const missed: DebriefMiss[] = [];
  const misses = def.rubric.misses;
  for (const h of def.history) {
    if (h.importance === "essential" && hidden.history[h.id] === undefined) {
      missed.push(misses[h.id] ?? { what: `Did not ask about ${h.label.toLowerCase()}.`, why: "This was a key part of the history in this case.", better: `Ask about ${h.label.toLowerCase()} early in the encounter.`, severity: "moderate" });
    }
  }
  for (const e of def.exam) {
    if (e.importance === "essential" && hidden.exams[e.id] === undefined) {
      missed.push(misses[e.id] ?? { what: `Did not examine: ${e.label}.`, why: "The key physical sign in this case was here.", better: `Examine ${e.label.toLowerCase()} specifically.`, severity: "moderate" });
    }
  }
  for (const i of def.investigations) {
    if (i.priority === "essential" && !ordered.has(i.id)) {
      const name = i.short ?? catalogInvestigation(i.id)?.short ?? i.name ?? i.id;
      missed.push(misses[i.id] ?? { what: `Did not order ${name}.`, why: i.teaching.whatItTellsYou, better: i.teaching.whenToOrder, severity: "moderate" });
    }
  }
  for (const group of def.rubric.idealTreatment) {
    if (!group.some(did)) {
      const key = group.find((id) => misses[id]) ?? group[0]!;
      const rule = def.therapeutics.find((r) => r.id === key);
      missed.push(misses[key] ?? { what: `Did not give: ${rule?.label ?? key}.`, why: "This is a core part of treatment for this condition.", better: `Include ${rule?.label.toLowerCase() ?? key} in the plan.`, severity: "major" });
    }
  }
  for (const r of def.therapeutics) {
    if (did(r.id) && r.critique) missed.push(r.critique);
  }
  for (const d of hidden.drugs) {
    if (d.frequencyError) missed.push({ what: `${d.generic} written ${d.frequency}.`, why: "This frequency is unsafe for this drug.", better: "Write the exact dosing day and interval in words.", severity: "major" });
    if (d.doseError) missed.push({ what: `${d.generic} ${d.dose ?? ""} — dose outside the safe range.`.replace(/\s+—/, " —"), why: "Under-dosing fails; over-dosing harms.", better: "Check the dose against weight, renal function and indication before ordering.", severity: "moderate" });
  }
  for (const h of hidden.hazards) {
    const hz = lib.get(h.id);
    if (!hz || hz.omission) continue;
    missed.push({ what: h.trigger, why: hz.review.whyItCausedHarm, better: hz.review.earliestRescueWindow, severity: "major" });
  }
  const unnecessary = [...new Map(hidden.investigations.filter((i) => i.priority === "unnecessary").map((i) => [i.defId, i])).values()];
  if (unnecessary.length > 0) {
    const cost = unnecessary.reduce((s, i) => s + i.cost, 0);
    missed.push({
      what: `Ordered ${unnecessary.map((i) => i.name).join(", ")} (₹${cost.toLocaleString("en-IN")}).`,
      why: "None of these would have changed management in this patient.",
      better: "Before each test, name the question it answers and the decision it changes.",
      severity: unnecessary.some((i) => i.cost >= 3000) ? "moderate" : "minor",
    });
  }
  if (verdict === "incorrect" || verdict === "partial") {
    missed.unshift({
      what: `Diagnosis recorded as “${hidden.diagnosis?.text ?? ""}”.`,
      why: verdict === "partial" ? `Close, but not specific enough — the diagnosis was ${def.truth.diagnosis.toLowerCase()}.` : `The findings pointed to ${def.truth.diagnosis.toLowerCase()}.`,
      better: def.truth.reasoning.map((r) => r.text).join(" → "),
      severity: verdict === "incorrect" ? "major" : "moderate",
    });
  }
  if (def.rubric.followUpDays && hidden.followUps.length === 0 && hidden.status !== "deceased") {
    missed.push({ what: "No follow-up was arranged.", why: "Response to treatment and adherence need to be checked.", better: `Review in ${def.rubric.followUpDays.min === def.rubric.followUpDays.max ? def.rubric.followUpDays.min : `${def.rubric.followUpDays.min}–${def.rubric.followUpDays.max}`} days.`, severity: "minor" });
  }
  missed.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  /* Rescue -------------------------------------------------------------- */
  const episodes: RescueEpisode[] = hidden.hazards.map((h) => {
    const hz = lib.get(h.id)!;
    const manifested = h.manifestedAt !== undefined;
    const outcome = h.died
      ? "The patient died."
      : !manifested
        ? "Not seen during the encounter — this would have unfolded after the case closed."
        : h.rescue === "full"
          ? `Full recovery — rescued ${describeSpan(Math.max(0, (h.rescuedAt ?? 0) - h.armedAt))} after onset.`
          : h.rescue === "partial"
            ? "Survived, but rescue came late: ICU care and a slower recovery."
            : h.rescue === "too-late"
              ? "Rescue measures came too late to change the course."
              : "Not rescued before the case closed.";
    return {
      label: hz.label,
      manifested,
      cause: hz.review.cause,
      whatYouDid: h.trigger,
      whyItCausedHarm: hz.review.whyItCausedHarm,
      earliestRescueWindow: hz.review.earliestRescueWindow,
      correctRescueSequence: hz.review.correctRescueSequence,
      lastRealisticRescueWindow: hz.review.lastRealisticRescueWindow,
      yourResponse: h.responses.length ? h.responses : manifested ? ["No rescue measures were taken."] : [],
      outcome,
      rescued: !manifested ? "not-applicable" : h.rescue === "full" ? "full" : h.rescue === "partial" ? "partial" : "no",
    };
  });

  /* Investigation teaching ---------------------------------------------- */
  const investigations: InvestigationTeaching[] = [
    ...def.investigations.map((i) => ({
      id: i.id,
      name: i.name ?? catalogInvestigation(i.id)?.name ?? i.id,
      whenToOrder: i.teaching.whenToOrder,
      whatItTellsYou: i.teaching.whatItTellsYou,
      cost: i.cost ?? catalogInvestigation(i.id)?.cost,
      priority: i.priority,
    })),
    ...(def.teaching.extraInvestigations ?? []),
  ];
  const rank = { essential: 0, useful: 1, situational: 2, unnecessary: 3 } as const;
  investigations.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return {
    caseRef: def.id,
    specialty: def.specialty,
    track: def.track,
    level: def.level,
    caseNumber: state.caseNumber,
    diagnosis: def.truth.diagnosis,
    qualifier: def.truth.qualifier,
    userDiagnosis: hidden.diagnosis?.text,
    verdict,
    finalStatus: hidden.status,
    elapsedMin: hidden.closedAt ?? hidden.clock,
    spend: hidden.investigations.reduce((s, i) => s + i.cost, 0),
    orderedInvestigationIds: [...ordered],
    score,
    reasoning: def.truth.reasoning,
    didWell: [...new Set(didWell)].slice(0, 8),
    missed: missed.slice(0, 10),
    severityBands: def.teaching.severityBands,
    patientBand: def.teaching.patientBand,
    treatmentByBand: def.teaching.treatmentByBand,
    drugs: def.teaching.drugs,
    routines: def.teaching.routines,
    investigations,
    rescue: {
      occurred: episodes.length > 0,
      episodes,
      counterfactual: episodes.length === 0 ? def.teaching.hazardTeaching : undefined,
    },
    followUp: def.teaching.followUp,
    treatmentFailure: def.teaching.treatmentFailure,
    pearl: def.teaching.pearl,
  };
}
