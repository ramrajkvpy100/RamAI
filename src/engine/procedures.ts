/**
 * Procedures can fail. What decides it is mostly the doctor's own technique, read from their words and what they did first
 * (oxygen before intubating, a sterile field for a line); a small risk stays however well it's done. The roll is fixed by the
 * case and the moment, so a case replays exactly. A complication that good technique couldn't prevent costs no marks.
 *
 * Risks are rounded teaching figures, in line with published rates; they aren't patient-level estimates.
 */
export interface ProcedureContext {
  /** The doctor's words. */
  phrase: string;
  age: number;
  /** Oxygen was already running. */
  preoxygenated: boolean;
  /** A sedative or paralytic went in within the last half hour. */
  sedated: boolean;
  plateletsLow: boolean;
  /** 0–99, fixed for this case at this moment. */
  roll: number;
  /** Raised-pressure signs in the story, and whether a head scan is back. */
  raisedIcpSigns: boolean;
  headScanBack: boolean;
}

export interface ProcedureOutcome {
  /** What's said happened. */
  note: string;
  /** The complication set off, if any. */
  hazard?: string;
  /** Good technique couldn't have prevented it. */
  unavoidable?: boolean;
  /** Oxygen lost during the attempt. */
  spo2Drop?: number;
  /** Extra minutes the attempt took. */
  extraMin?: number;
  /** What the doctor's technique missed, for the debrief. */
  lapses: string[];
}

const words = (re: RegExp, phrase: string) => re.test(phrase);

/** The right tube for this age: 7–8.5 in an adult, age/4 + 4 (±1) in a child. Undefined if none was named. */
export function tubeProblem(phrase: string, age: number): string | undefined {
  const named = phrase.match(/\b(?:size\s*)?(\d{1,2}(?:\.\d)?)\s*(?:mm\b|sized?\b|et\s*tube|ett\b|tube\b)/i) ?? phrase.match(/\b(?:size|tube)\s*(\d{1,2}(?:\.\d)?)\b/i);
  if (!named) return undefined;
  const size = Number(named[1]);
  const [lo, hi] = age >= 14 ? [6.5, 8.5] : [age / 4 + 3, age / 4 + 5];
  return size < lo || size > hi ? `a size ${size} tube is wrong for this patient` : undefined;
}

function intubation(c: ProcedureContext): ProcedureOutcome {
  const lapses: string[] = [];
  if (!c.preoxygenated && !words(/pre-?ox/i, c.phrase)) lapses.push("no pre-oxygenation");
  if (!c.sedated && !words(/\brsi\b|rapid sequence|ketamine|etomidate|propofol|midazolam|rocuronium|succinyl|suxamethonium|vecuronium/i, c.phrase)) lapses.push("no induction drugs or paralysis");
  const wrongTube = tubeProblem(c.phrase, c.age);
  if (wrongTube) lapses.push(wrongTube);
  const confirmed = words(/capno|etco2|et co2|end.?tidal|auscultat|listen|chest rise|confirm/i, c.phrase);

  const failChance = 8 + 22 * lapses.length;
  if (!confirmed && c.roll < 6) {
    return { note: "Tube passed, but the saturation keeps falling and no CO₂ trace was checked.", hazard: "proc-oesophageal", lapses: [...lapses, "placement not confirmed"] };
  }
  if (c.roll < failChance + 6 && c.roll >= 6) {
    return { note: `First attempt failed — the saturation fell during it. Second attempt passed${confirmed ? ", confirmed on capnography" : ""}.`, spo2Drop: lapses.length ? 12 : 5, extraMin: 4, unavoidable: lapses.length === 0, lapses };
  }
  if (c.roll >= 90 || (!confirmed && c.roll >= 75)) {
    return { note: "Intubated. The saturation stays low, though.", hazard: "proc-mainstem", unavoidable: confirmed && lapses.length === 0, lapses: confirmed ? lapses : [...lapses, "tube depth not checked"] };
  }
  return { note: confirmed ? "Intubated at the first attempt; tube position confirmed." : "Intubated at the first attempt.", lapses };
}

function centralLine(c: ProcedureContext): ProcedureOutcome {
  const lapses: string[] = [];
  const femoral = words(/femoral/i, c.phrase);
  const guided = words(/ultrasound|usg|sono/i, c.phrase);
  const sterile = words(/sterile|asepti[cs]|full barrier|chlorhexidine/i, c.phrase);
  if (!guided) lapses.push("no ultrasound guidance");
  if (!sterile) lapses.push("no sterile technique stated");
  if (c.roll < (guided ? 2 : 8) && !femoral) return { note: "Line placed, but they're suddenly more breathless on that side.", hazard: "proc-pneumothorax", unavoidable: guided, lapses };
  if (c.roll >= 96 - (guided ? 0 : 8) || (c.plateletsLow && c.roll >= 80)) return { note: "Bright, pulsatile blood on the first pass: the artery was hit. Pressure held, and the line placed at the second pass.", hazard: "proc-arterial", unavoidable: guided && !c.plateletsLow, lapses };
  if (!sterile && c.roll >= 40 && c.roll < 70) return { note: "Central line placed and secured.", hazard: "proc-line-infection", lapses };
  return { note: `Central line placed${guided ? " under ultrasound" : ""} and secured.`, lapses };
}

function chestTube(c: ProcedureContext): ProcedureOutcome {
  const lapses: string[] = [];
  if (!words(/sterile|asepti[cs]/i, c.phrase)) lapses.push("no sterile technique stated");
  if (!words(/safe triangle|5th|fifth|mid.?axillary|anterior axillary/i, c.phrase)) lapses.push("no safe site stated");
  const missedSite = lapses.includes("no safe site stated");
  if (c.roll < (missedSite ? 8 : 1)) return { note: "Tube inserted, but it isn't swinging or bubbling, and they're getting worse.", hazard: "proc-tube-misplaced", unavoidable: !missedSite, lapses };
  return { note: "Chest tube in, swinging and bubbling.", lapses };
}

function paracentesis(c: ProcedureContext): ProcedureOutcome {
  const lapses: string[] = [];
  const litres = Number(c.phrase.match(/(\d+(?:\.\d+)?)\s*(?:l\b|litres?|liters?)/i)?.[1] ?? 0);
  const albumin = words(/albumin/i, c.phrase);
  if (litres >= 5 && !albumin) {
    lapses.push("large-volume tap without albumin");
    return { note: `${litres} L of ascitic fluid drained.`, hazard: "proc-para-hypotension", lapses };
  }
  if (c.roll >= 97 || (c.plateletsLow && c.roll >= 85)) return { note: "Fluid drawn, then it turned bloody: the abdominal wall vessel bled.", hazard: "proc-arterial", unavoidable: !c.plateletsLow, lapses };
  return { note: "Paracentesis done; fluid sent.", lapses };
}

/** A lumbar puncture, as an order for CSF. Only what can go wrong is returned. */
export function lumbarPuncture(c: ProcedureContext): ProcedureOutcome | undefined {
  if (c.raisedIcpSigns && !c.headScanBack) return { note: "CSF came out under high pressure.", hazard: "proc-lp-herniation", lapses: ["LP with signs of raised pressure and no head scan first"] };
  if (c.plateletsLow) return { note: "LP done, with low platelets.", hazard: "proc-spinal-haematoma", lapses: ["LP with low platelets"] };
  return undefined;
}

const OUTCOMES: Record<string, (c: ProcedureContext) => ProcedureOutcome> = { intubation, "central-line": centralLine, "chest-tube": chestTube, paracentesis };

export function runProcedure(id: string, c: ProcedureContext): ProcedureOutcome | undefined {
  return OUTCOMES[id]?.(c);
}
