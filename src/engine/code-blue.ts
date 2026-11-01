/**
 * Code Blue: when a patient would die in hospital, they arrest instead, and normal chat stops until the doctor runs the
 * arrest. Rules only, no AI. Follows the AHA adult cardiac arrest algorithm: CPR, a shock for VF/pVT, adrenaline 1 mg
 * every 3–5 minutes, amiodarone 300 mg for refractory VF/pVT, treat the reversible cause, stop after a long failed effort.
 */
import type { TurnEffect } from "./types";
import { drugMatchPhrases, formularyDrug } from "./formulary";

export type ArrestRhythm = "VF" | "PEA" | "asystole";

export interface CodeBlue {
  active: boolean;
  startedAt: number;
  rhythm: ArrestRhythm;
  hazardId?: string;
  /** Minutes the cause had been at work: too long (liver failure) and no resuscitation brings them back. */
  terminal: boolean;
  /** Drugs that treat the cause; one is enough. Empty: no specific treatment. */
  causeDrugs: string[];
  causeTreated: boolean;
  cprAt?: number;
  shocks: number;
  adrenaline: number;
  antiarrhythmic: boolean;
  airway: boolean;
  errors: string[];
  outcome?: "rosc" | "died";
}

const SHOCK_RE = /\b(shock|defib\w*|dc ?shock|cardiovert\w*|200 ?j|360 ?j)\b/i;
const CPR_RE = /\b(cpr|compressions?|chest compressions?|bls|acls|start resus\w*|resuscitate)\b/i;
const ADRENALINE_RE = /\b(adrenaline|adrenalin|epinephrine|epi)\b/i;
const AMIODARONE_RE = /\b(amiodarone|lidocaine|lignocaine)\b/i;
const AIRWAY_RE = /\b(bvm|bag|ambu|airway|intubat\w*|et tube|ett|oxygen|o2|ventilat\w*)\b/i;
const RHYTHM_RE = /\b(rhythm|monitor|pulse check|check (?:the )?pulse|what.*(?:rhythm|monitor))\b/i;
const STOP_RE = /\b(time of death|stop (?:the )?(?:cpr|resus\w*|code)|call (?:it|the code)|terminate|declare|cease (?:cpr|resus\w*))\b/i;

export const CODE_BUTTONS = ["Start CPR", "Shock now", "Adrenaline 1 mg IV", "Amiodarone 300 mg IV", "Bag-mask ventilation", "Check rhythm", "Stop resuscitation"];
const buttons = () => CODE_BUTTONS.map((text) => ({ text, send: true }));

export const rhythmFrom = (text: string): ArrestRhythm => (/fibrillation|\bvf\b|\bvt\b|ventricular tachy|wide, bizarre/i.test(text) ? "VF" : /asystole|flat ?line/i.test(text) ? "asystole" : "PEA");

const nurse = (text: string, withButtons = true): TurnEffect => ({ type: "message", role: "nurse", kind: "speech", text, ...(withButtons ? { replies: buttons() } : {}) });

export function codeStartEffects(code: CodeBlue): TurnEffect[] {
  return [
    { type: "code_blue", active: true },
    { type: "timeline", label: `Cardiac arrest — ${code.rhythm}`, category: "status" },
    nurse(`CODE BLUE. No pulse, doctor. The monitor shows ${rhythmName(code.rhythm)}. What are your orders?`),
  ];
}

const rhythmName = (r: ArrestRhythm) => (r === "VF" ? "ventricular fibrillation" : r === "PEA" ? "organised electrical activity with no pulse (PEA)" : "asystole");

const treatsCause = (code: CodeBlue, raw: string) =>
  code.causeDrugs.some((id) => {
    const drug = formularyDrug(id);
    return !!drug && drugMatchPhrases(drug).some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(raw));
  });

/** What the doctor's words do to the arrest. Returns the effects, and whether the arrest is over. */
export function codeTurn(code: CodeBlue, raw: string, clock: number): { effects: TurnEffect[]; minutes: number; result?: "rosc" | "died" } {
  const fx: TurnEffect[] = [];
  const elapsed = clock - code.startedAt;
  if (STOP_RE.test(raw)) return { effects: fx, minutes: 0, result: "died" };
  if (RHYTHM_RE.test(raw) && !CPR_RE.test(raw) && !SHOCK_RE.test(raw) && !ADRENALINE_RE.test(raw)) {
    return { effects: [nurse(`Still no pulse, doctor: ${rhythmName(code.rhythm)}. ${Math.round(elapsed)} minutes into the arrest.`)], minutes: 0 };
  }
  let acted = false;
  if (CPR_RE.test(raw)) {
    acted = true;
    if (code.cprAt === undefined) {
      code.cprAt = clock;
      fx.push({ type: "message", role: "system", kind: "action", text: "CPR started: hard, fast compressions, 30:2 until there's an advanced airway." });
    } else fx.push({ type: "message", role: "system", kind: "action", text: "CPR continuing." });
  }
  if (AIRWAY_RE.test(raw)) {
    acted = true;
    code.airway = true;
    fx.push({ type: "message", role: "system", kind: "action", text: /intubat|et tube|ett/i.test(raw) ? "Intubated without stopping compressions." : "Bag-mask ventilation with 100% oxygen." });
  }
  if (SHOCK_RE.test(raw)) {
    acted = true;
    if (code.rhythm === "VF") {
      code.shocks += 1;
      fx.push({ type: "message", role: "system", kind: "action", text: `Shock ${code.shocks} delivered. Back on the chest straight away.` });
    } else {
      code.errors.push(`Tried to shock ${code.rhythm}, which isn't a shockable rhythm.`);
      fx.push(nurse(`Doctor, this is ${rhythmName(code.rhythm)} — it isn't shockable. CPR and adrenaline?`));
    }
  }
  if (ADRENALINE_RE.test(raw)) {
    acted = true;
    const wrong = /\b(?:[2-9]|\d{2,})(?:\.\d+)?\s*mg\b/i.test(raw) || /\bsc\b|\bim\b|subcut/i.test(raw);
    if (wrong) code.errors.push("Adrenaline in arrest is 1 mg IV or IO; a different dose or route was ordered.");
    code.adrenaline += 1;
    fx.push({ type: "message", role: "system", kind: "action", text: "Adrenaline 1 mg IV given (repeat every 3–5 minutes)." });
  }
  if (AMIODARONE_RE.test(raw)) {
    acted = true;
    if (code.rhythm === "VF") {
      code.antiarrhythmic = true;
      fx.push({ type: "message", role: "system", kind: "action", text: "Antiarrhythmic given." });
    } else {
      code.errors.push(`Gave an antiarrhythmic in ${code.rhythm}.`);
      fx.push(nurse(`Doctor, that's for VF, and this is ${rhythmName(code.rhythm)}. CPR and adrenaline?`));
    }
  }
  if (!code.causeTreated && treatsCause(code, raw)) {
    acted = true;
    code.causeTreated = true;
    fx.push({ type: "message", role: "system", kind: "action", text: "Given for the suspected cause of the arrest." });
  }
  if (!acted) {
    // The arrest doesn't wait: anything else costs a minute of it.
    return { effects: [nurse(code.cprAt === undefined ? "Doctor, there's no pulse! That has to wait. What do you want done for the arrest?" : "Doctor, the patient is in arrest — CPR is running. What next? Think about what caused this too.")], minutes: 1, ...outcome(code, clock + 1) };
  }
  return { effects: fx, minutes: 2, ...outcome(code, clock + 2) };
}

/** Whether, after these minutes, the arrest has ended. */
export function outcome(code: CodeBlue, clock: number): { result?: "rosc" | "died" } {
  const elapsed = clock - code.startedAt;
  if (code.cprAt === undefined) return elapsed >= 6 ? { result: "died" } : {};
  const lateCpr = code.cprAt - code.startedAt > 6;
  const causeOk = code.causeDrugs.length === 0 || code.causeTreated;
  const algorithmDone = code.rhythm === "VF" ? code.shocks >= 2 && code.adrenaline >= 1 : code.adrenaline >= 1 && elapsed >= 4;
  if (!lateCpr && !code.terminal && causeOk && algorithmDone) return { result: "rosc" };
  return elapsed >= 20 ? { result: "died" } : {};
}
