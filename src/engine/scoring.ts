/**
 * Scoring — /100 across ten categories, computed from the hidden state after
 * closure. Category weights default to the RamAI standard and can be
 * adapted per case via `rubric.weights`.
 */

import { catalogInvestigation, flagVital } from "./catalog";
import type { ClinicalCaseDefinition, ScoreWeights } from "./case-definition";
import { hazardLibrary } from "./physiology";
import { treatmentQuality, type HiddenState } from "./simulator";
import { findPhrase, normalise, tokens } from "./text";
import type { CaseScore, DiagnosisVerdict, ScoreAdjustment, ScoreCategory, ScoreLine, VitalKey } from "./types";

export const DEFAULT_WEIGHTS: Required<ScoreWeights> = {
  history: 20,
  examination: 10,
  differential: 10,
  investigationSelection: 10,
  investigationInterpretation: 10,
  treatment: 15,
  drugSafety: 10,
  reassessment: 5,
  efficiency: 5,
  outcome: 5,
};

const LABELS: Record<ScoreCategory, string> = {
  history: "History",
  examination: "Examination",
  differential: "Differential reasoning",
  investigationSelection: "Investigation selection",
  investigationInterpretation: "Investigation interpretation",
  treatment: "Treatment",
  drugSafety: "Drug safety",
  reassessment: "Reassessment",
  efficiency: "Efficiency",
  outcome: "Outcome",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function judgeDiagnosis(def: ClinicalCaseDefinition, text: string | undefined): DiagnosisVerdict {
  if (!text?.trim()) return "not-recorded";
  const tk = tokens(normalise(text));
  if (def.rubric.diagnosisAccept.some((p) => findPhrase(tk, p))) return "correct";
  if (def.rubric.diagnosisPartial.some((p) => findPhrase(tk, p))) return "partial";
  return "incorrect";
}

/** The treatments that show the disease was recognised: the definitive one, else the whole ideal plan. */
function recognitionIds(def: ClinicalCaseDefinition): string[][] {
  const definitive = def.rubric.definitiveTreatment;
  return definitive ? [definitive.ids] : def.rubric.idealTreatment;
}

/** When the management first acted on the diagnosis — the decision point if none was stated. */
function recognisedAt(def: ClinicalCaseDefinition, hidden: HiddenState): number | undefined {
  const times = recognitionIds(def).flat().map((id) => hidden.actions[id]?.[0]).filter((t): t is number => t !== undefined);
  return times.length ? Math.min(...times) : undefined;
}

/**
 * The diagnosis is never demanded at the end. A diagnosis stated during the
 * encounter is judged on its words; otherwise management that treats the
 * disease — the definitive treatment, or most of the ideal plan — shows it
 * was recognised.
 */
export function diagnosisVerdict(def: ClinicalCaseDefinition, hidden: HiddenState): DiagnosisVerdict {
  if (hidden.diagnosis?.text.trim()) return judgeDiagnosis(def, hidden.diagnosis.text);
  const did = (id: string) => (hidden.actions[id]?.length ?? 0) > 0;
  const groups = recognitionIds(def);
  if (def.rubric.definitiveTreatment) return groups[0]!.some(did) ? "implied" : "not-recorded";
  return groups.length > 0 && groups.filter((g) => g.some(did)).length * 2 >= groups.length ? "implied" : "not-recorded";
}

function weights(def: ClinicalCaseDefinition): Required<ScoreWeights> {
  return { ...DEFAULT_WEIGHTS, ...(def.rubric.weights ?? {}) };
}

export function calculateScore(def: ClinicalCaseDefinition, hidden: HiddenState): CaseScore {
  const W = weights(def);
  const lines: ScoreLine[] = [];
  const penalties: ScoreAdjustment[] = [];
  const bonuses: ScoreAdjustment[] = [];
  const line = (category: ScoreCategory, fraction: number, notes: string[]) => {
    const max = W[category];
    // A category weighted 0 for this case (e.g. examination on a phone call) is not shown.
    if (max <= 0) return;
    lines.push({ category, label: LABELS[category], max, earned: Math.round(max * clamp01(fraction) * 10) / 10, notes });
  };

  const verdict = diagnosisVerdict(def, hidden);
  const closedAt = hidden.closedAt ?? hidden.clock;

  /* History & examination: essentials carry 75%, useful items 25% ------- */
  const split = (essentialDone: number, essentialTotal: number, usefulDone: number, usefulTotal: number) => {
    const e = essentialTotal === 0 ? 1 : essentialDone / essentialTotal;
    const u = usefulTotal === 0 ? 1 : usefulDone / usefulTotal;
    return 0.75 * e + 0.25 * u;
  };
  {
    const essential = def.history.filter((h) => h.importance === "essential");
    const useful = def.history.filter((h) => h.importance === "useful");
    const missed = essential.filter((h) => hidden.history[h.id] === undefined).map((h) => h.label);
    const missedUseful = useful.filter((h) => hidden.history[h.id] === undefined).map((h) => h.label);
    const notes: string[] = [];
    if (missed.length) notes.push(`Key history not obtained: ${missed.join(", ")}`);
    if (missedUseful.length) notes.push(`Also worth asking: ${missedUseful.slice(0, 5).join(", ")}${missedUseful.length > 5 ? "…" : ""}`);
    if (!notes.length) notes.push("Thorough, focused history");
    line("history", split(essential.length - missed.length, essential.length, useful.length - missedUseful.length, useful.length), notes);
  }
  {
    const essential = def.exam.filter((e) => e.importance === "essential");
    const useful = def.exam.filter((e) => e.importance === "useful");
    const missed = essential.filter((e) => hidden.exams[e.id] === undefined).map((e) => e.label);
    const missedUseful = useful.filter((e) => hidden.exams[e.id] === undefined).map((e) => e.label);
    // Objectively abnormal vitals count as essential examination.
    let vitalsDue = 0;
    let vitalsDone = 0;
    for (const [key, patch] of Object.entries(def.baselineVitals)) {
      if (!patch || ["weight", "height", "bmi", "pain", "urine"].includes(key)) continue;
      if (flagVital(key as VitalKey, patch.value).flag === "normal") continue;
      vitalsDue += 1;
      if (hidden.measured.includes(key as VitalKey)) vitalsDone += 1;
      else missed.push(key === "rbs" ? "RBS" : key === "spo2" ? "SpO₂" : key.toUpperCase());
    }
    const notes: string[] = [];
    if (missed.length) notes.push(`Key findings not examined: ${missed.join(", ")}`);
    if (missedUseful.length) notes.push(`Also worth examining: ${missedUseful.slice(0, 5).join(", ")}${missedUseful.length > 5 ? "…" : ""}`);
    if (!notes.length) notes.push("Complete, focused examination");
    const essentialTotal = essential.length + vitalsDue;
    const essentialDone = essential.length - essential.filter((e) => hidden.exams[e.id] === undefined).length + vitalsDone;
    line("examination", split(essentialDone, essentialTotal, useful.length - missedUseful.length, useful.length), notes);
  }

  /* Differential reasoning --------------------------------------------- */
  {
    const base = verdict === "correct" ? 0.7 : verdict === "implied" ? 0.55 : verdict === "partial" ? 0.4 : 0;
    const credited = hidden.differentials.filter((d) => {
      const tk = tokens(normalise(d));
      return def.rubric.differentials.some((p) => findPhrase(tk, p)) || def.rubric.diagnosisAccept.some((p) => findPhrase(tk, p));
    });
    const ddxCredit = Math.min(0.3, credited.length * 0.1);
    const notes: string[] = [];
    notes.push(
      verdict === "correct"
        ? "Correct diagnosis"
        : verdict === "partial"
          ? "Diagnosis partially correct"
          : verdict === "incorrect"
            ? "Diagnosis incorrect"
            : verdict === "implied"
              ? "Diagnosis not stated — your management showed you recognised it"
              : "Diagnosis not stated, and the management didn't treat it",
    );
    if (hidden.differentials.length === 0) notes.push("No differential recorded");
    else notes.push(`${credited.length} of ${hidden.differentials.length} differentials reasonable`);
    line("differential", base + ddxCredit + (verdict === "correct" && hidden.differentials.length === 0 ? 0.15 : 0), notes);
  }

  /* Investigation selection -------------------------------------------- */
  const ordered = new Set(hidden.investigations.map((i) => i.defId));
  const essentials = def.investigations.filter((i) => i.priority === "essential");
  const useful = def.investigations.filter((i) => i.priority === "useful");
  {
    const essFrac = essentials.length === 0 ? 1 : essentials.filter((i) => ordered.has(i.id)).length / essentials.length;
    const usefulFrac = useful.length === 0 ? 1 : Math.min(1, useful.filter((i) => ordered.has(i.id)).length / Math.max(1, Math.ceil(useful.length / 2)));
    const unnecessary = [...new Map(hidden.investigations.filter((i) => i.priority === "unnecessary").map((i) => [i.defId, i])).values()];
    let penalty = 0;
    for (const u of unnecessary) penalty += u.cost >= 3000 ? 0.12 : u.cost >= 500 ? 0.06 : 0.03;
    const spendWasted = unnecessary.reduce((s, u) => s + u.cost, 0);
    if (unnecessary.length > 0) {
      penalties.push({ label: "Unnecessary investigations", points: -Math.round(W.investigationSelection * Math.min(penalty, 1) * 10) / 10, reason: `${unnecessary.map((u) => u.name).join(", ")} — ₹${spendWasted.toLocaleString("en-IN")}` });
    }
    const missed = essentials.filter((i) => !ordered.has(i.id)).map((i) => i.short ?? catalogInvestigation(i.id)?.short ?? i.name ?? i.id);
    const notes: string[] = [];
    if (missed.length) notes.push(`Missed: ${missed.join(", ")}`);
    if (unnecessary.length) notes.push(`Unnecessary: ${unnecessary.map((u) => u.name).join(", ")}`);
    if (!notes.length) notes.push("Well-targeted work-up");
    const frac = essentials.length === 0 && useful.length === 0 ? 1 - penalty : 0.7 * essFrac + 0.3 * usefulFrac - penalty;
    line("investigationSelection", frac, notes);

    const spend = hidden.investigations.reduce((s, i) => s + i.cost, 0);
    const essentialSpend = essentials.reduce((s, i) => s + (i.cost ?? catalogInvestigation(i.id)?.cost ?? 0), 0);
    if (W.investigationSelection > 0 && essFrac === 1 && unnecessary.length === 0 && spend <= Math.max(essentialSpend * 1.6, 600)) {
      bonuses.push({ label: "Cost-effective work-up", points: 0, reason: `₹${spend.toLocaleString("en-IN")} spent on investigations` });
    }
  }

  /* Investigation interpretation --------------------------------------- */
  {
    const verdictFactor = verdict === "correct" ? 1 : verdict === "implied" ? 0.85 : verdict === "partial" ? 0.6 : verdict === "incorrect" ? 0.2 : 0;
    const decisionAt = hidden.diagnosis?.at ?? (verdict === "implied" ? recognisedAt(def, hidden) : undefined) ?? closedAt;
    let frac: number;
    const notes: string[] = [];
    if (essentials.length === 0) {
      frac = verdictFactor;
      notes.push("Diagnosis rested on clinical findings");
    } else {
      const seen = essentials.filter((e) => hidden.investigations.some((i) => i.defId === e.id && i.delivered && i.resultAt <= decisionAt)).length;
      frac = (seen / essentials.length) * verdictFactor;
      if (seen < essentials.length) notes.push(`${essentials.length - seen} key result(s) not reviewed before the diagnosis`);
      else notes.push("Key results reviewed before committing to a diagnosis");
      const pendingAtClose = hidden.investigations.filter((i) => !i.delivered && def.investigations.some((d) => d.id === i.defId && d.priority === "essential"));
      if (pendingAtClose.length > 0) {
        penalties.push({ label: "Premature closure", points: -Math.round(W.investigationInterpretation * 0.3 * 10) / 10, reason: `Closed with ${pendingAtClose.map((i) => i.name).join(", ")} still pending` });
        frac -= 0.3;
      }
    }
    if (verdict === "incorrect" && essentials.length > 0 && essentials.every((e) => ordered.has(e.id))) {
      penalties.push({ label: "Diagnosis not revised", points: 0, reason: "The results available pointed elsewhere" });
    }
    line("investigationInterpretation", frac, notes);
  }

  /* Treatment ------------------------------------------------------------ */
  const quality = treatmentQuality(def, hidden);
  {
    const done = (id: string) => (hidden.actions[id]?.length ?? 0) > 0;
    const groups = def.rubric.idealTreatment;
    const satisfied = groups.filter((g) => g.some(done)).length;
    let frac = groups.length === 0 ? 1 : (satisfied / groups.length) * 0.85 + 0.15;
    const notes: string[] = [];
    const unnecessaryDrugs = [...new Set(hidden.drugs.filter((d) => d.appropriateness === "unnecessary").map((d) => d.generic))];
    if (unnecessaryDrugs.length) {
      frac -= Math.min(0.4, unnecessaryDrugs.length * 0.1);
      penalties.push({ label: "Unnecessary medications", points: -Math.round(W.treatment * Math.min(0.4, unnecessaryDrugs.length * 0.1) * 10) / 10, reason: unnecessaryDrugs.join(", ") });
      notes.push(`Unnecessary: ${unnecessaryDrugs.join(", ")}`);
    }
    const definitive = def.rubric.definitiveTreatment;
    if (definitive) {
      const times = definitive.ids.flatMap((id) => hidden.actions[id] ?? []);
      const first = times.length ? Math.min(...times) : undefined;
      if (first === undefined || first > definitive.byMinute) {
        frac -= 0.25;
        penalties.push({ label: "Delayed treatment", points: -Math.round(W.treatment * 0.25 * 10) / 10, reason: first === undefined ? `${definitive.label} was never done` : `${definitive.label} was delayed` });
      }
    }
    if (quality === "harmful") frac = Math.min(frac, 0.5);
    notes.unshift(satisfied === groups.length ? "Complete, appropriate treatment" : `${satisfied} of ${groups.length} essential treatment elements given`);
    line("treatment", frac, notes);
  }

  /* Drug safety ---------------------------------------------------------- */
  {
    let frac = 1;
    const notes: string[] = [];
    for (const d of hidden.drugs) {
      if (d.appropriateness === "dangerous") { frac -= 0.7; notes.push(`Dangerous: ${d.generic}`); penalties.push({ label: "Dangerous order", points: -Math.round(W.drugSafety * 0.7 * 10) / 10, reason: d.generic }); }
      else if (d.appropriateness === "harmful") { frac -= 0.4; notes.push(`Harmful: ${d.generic}`); penalties.push({ label: "Harmful medication", points: -Math.round(W.drugSafety * 0.4 * 10) / 10, reason: d.generic }); }
      if (d.doseError) { frac -= 0.3; notes.push(`Dose outside the safe range: ${d.generic} ${d.dose ?? ""}`.trim()); penalties.push({ label: "Wrong dose", points: -Math.round(W.drugSafety * 0.3 * 10) / 10, reason: `${d.generic} ${d.dose ?? ""}`.trim() }); }
      if (d.frequencyError) { frac -= 0.6; notes.push(`Wrong frequency: ${d.generic} ${d.frequency ?? ""}`.trim()); penalties.push({ label: "Wrong frequency", points: -Math.round(W.drugSafety * 0.6 * 10) / 10, reason: `${d.generic} ${d.frequency ?? ""}`.trim() }); }
    }
    for (const r of def.therapeutics) {
      if ((r.appropriateness === "dangerous" || r.appropriateness === "harmful") && r.kind !== "drug" && (hidden.actions[r.id]?.length ?? 0) > 0) {
        frac -= r.appropriateness === "dangerous" ? 0.7 : 0.4;
        notes.push(`${r.appropriateness === "dangerous" ? "Dangerous" : "Harmful"}: ${r.label}`);
      }
    }
    const lib = hazardLibrary(def);
    for (const h of hidden.hazards) {
      if (lib.get(h.id)?.omission) continue;
      frac -= 0.5;
      notes.push(`Triggered: ${h.label}`);
    }
    const firstDrug = hidden.drugs[0];
    const allergyEntry = def.history.find((h) => h.group === "allergy");
    if (firstDrug && allergyEntry && (hidden.history[allergyEntry.id] === undefined || hidden.history[allergyEntry.id]! > firstDrug.at)) {
      frac -= 0.1;
      notes.push("Prescribed before asking about allergies");
    }
    const teratogens = hidden.drugs.filter((d) => d.classes.includes("teratogen"));
    if (def.profile.pregnancyPossible && teratogens.length > 0) {
      const checked = hidden.investigations.some((i) => i.defId === "upt" && i.orderedAt <= teratogens[0]!.at);
      if (!checked) {
        frac -= 0.5;
        notes.push(`Teratogen (${teratogens[0]!.generic}) without excluding pregnancy`);
        penalties.push({ label: "Pregnancy not excluded", points: -Math.round(W.drugSafety * 0.5 * 10) / 10, reason: teratogens[0]!.generic });
      }
    }
    if (!notes.length) notes.push("No safety concerns");
    line("drugSafety", frac, notes);
  }

  /* Reassessment --------------------------------------------------------- */
  {
    const notes: string[] = [];
    let frac = 0;
    if (!def.rubric.expectsReassessment && !hidden.hazards.some((h) => h.manifestedAt !== undefined)) {
      frac = 1;
      const fu = hidden.followUps[0];
      if (def.rubric.followUpDays && !fu) { frac = 0.6; notes.push("No follow-up arranged"); }
      else notes.push("Appropriate for this encounter");
    } else {
      const after = hidden.firstTreatmentAt ?? 0;
      if (hidden.reassessments.some((t) => t >= after)) { frac += 0.5; notes.push("Reassessed after treatment"); }
      else notes.push("No reassessment after treatment");
      const fu = hidden.followUps[0];
      if (fu && def.rubric.followUpDays && fu.days >= def.rubric.followUpDays.min && fu.days <= def.rubric.followUpDays.max) { frac += 0.5; notes.push("Follow-up at a sensible interval"); }
      else if (fu) { frac += 0.25; notes.push("Follow-up arranged, interval not ideal"); }
      else if (hidden.monitored) { frac += 0.5; notes.push("Monitored continuously"); }
      if (frac === 0) penalties.push({ label: "Failure to reassess", points: -W.reassessment, reason: "No repeat assessment, monitoring or follow-up" });
    }
    line("reassessment", frac, notes);
  }

  /* Efficiency ----------------------------------------------------------- */
  {
    const ratio = hidden.actionCount / Math.max(1, def.rubric.expertActionCount);
    const frac = ratio <= 1.3 ? 1 : ratio <= 2 ? 0.7 : ratio <= 3 ? 0.4 : 0.15;
    line("efficiency", frac, [`${hidden.actionCount} actions (expert: ~${def.rubric.expertActionCount})`]);
    if (ratio <= 1.3 && (verdict === "correct" || verdict === "implied")) bonuses.push({ label: "Efficient diagnosis", points: 0, reason: `Reached the diagnosis in ${hidden.actionCount} actions` });
  }

  /* Outcome -------------------------------------------------------------- */
  {
    let frac: number;
    const notes: string[] = [];
    const died = hidden.status === "deceased" || hidden.hazards.some((h) => h.died);
    const manifested = hidden.hazards.filter((h) => h.manifestedAt !== undefined);
    if (died) { frac = 0; notes.push("The patient died"); }
    else if (manifested.length > 0) {
      const worst = manifested.some((h) => h.rescue !== "full" && h.rescue !== "partial") ? 0.1 : manifested.some((h) => h.rescue === "partial") ? 0.45 : 0.85;
      frac = worst;
      notes.push(worst >= 0.85 ? "Deterioration recognised and reversed" : worst >= 0.45 ? "Rescued late — survived with harm" : "Deterioration not reversed");
      if (worst >= 0.85) bonuses.push({ label: "Rescued deterioration", points: 0, reason: manifested.map((h) => h.label).join(", ") });
    } else if (hidden.hazards.length > 0) {
      frac = 0.15;
      notes.push("Harm set in motion after discharge");
    } else {
      frac = quality === "ideal" ? 1 : quality === "acceptable" ? 0.7 : quality === "untreated" ? 0.3 : 0.1;
      notes.push(quality === "ideal" ? "Expected full recovery" : quality === "acceptable" ? "Likely recovery, suboptimal plan" : quality === "untreated" ? "Condition left untreated" : "Treatment likely to cause harm");
    }
    line("outcome", frac, notes);
  }

  const total = Math.round(lines.reduce((s, l) => s + l.earned, 0));
  const max = lines.reduce((s, l) => s + l.max, 0);
  const percent = Math.round((total / max) * 1000) / 10;
  const died = hidden.status === "deceased";
  const rescueBonus = bonuses.some((b) => b.label === "Rescued deterioration") ? 25 : 0;
  const efficientBonus = bonuses.some((b) => b.label === "Efficient diagnosis") ? 10 : 0;
  const xp = died ? Math.round(total * 0.6) : Math.round(total * 1.2 + def.difficulty * 8 + rescueBonus + efficientBonus);

  return { total, max, percent, lines, xp, penalties, bonuses };
}
