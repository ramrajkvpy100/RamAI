import { describe, expect, it } from "vitest";

import { breathSounds, heardIn, heartSounds, listen } from "@/engine/auscultation";
import { CASE_LIBRARY } from "@/engine/cases";
import { emAdhf } from "@/engine/cases/em-adhf";
import { resolveIntents } from "@/engine/intent";
import { generateDebrief } from "@/engine/debrief";

import { play } from "./helpers";

const intentOf = (text: string, def = emAdhf) => resolveIntents(text, { def, setting: "ER", weightKg: 70 }).map((i) => `${i.kind}:${i.targetId ?? ""}`);

describe("asking to auscultate", () => {
  it("understands the stethoscope, with or without a verb", () => {
    expect(intentOf("Auscultate the chest")).toEqual(["exam:breath-sounds"]);
    expect(intentOf("listen to the heart")).toEqual(["exam:heart-sounds"]);
    expect(intentOf("heart sounds?")).toEqual(["exam:heart-sounds"]);
    expect(intentOf("Breath sounds")).toEqual(["exam:breath-sounds"]);
    expect(intentOf("bowel sounds")).toEqual(["exam:bowel-sounds"]);
    expect(intentOf("auscultate")).toEqual(["exam:auscultation"]);
    expect(intentOf("check for wheeze")).toEqual(["exam:breath-sounds"]);
  });

  it("still gives the whole examination when that's what was asked for", () => {
    expect(intentOf("Examine CVS")).toEqual(["exam:cvs"]);
    expect(intentOf("examine the chest")).toEqual(["exam:rs"]);
    expect(intentOf("Examine abdomen")).toEqual(["exam:abdomen"]);
  });

  it("leaves symptom questions for the patient", () => {
    expect(intentOf("Do you wheeze?")[0]).not.toMatch(/^exam:/);
    expect(intentOf("Any wheezing?")[0]).toMatch(/^history:/);
    expect(intentOf("Is there any murmur?")).toEqual(["exam:heart-sounds"]);
  });
});

describe("what the stethoscope picks up", () => {
  it("is only the sounds — not the rest of the examination", () => {
    const cvs = "Pulse irregularly irregular. Apex displaced to the 6th intercostal space, anterior axillary line. S3 gallop; apical pansystolic murmur radiating to the axilla.";
    expect(heardIn(cvs, "heart")).toBe("S3 gallop. Apical pansystolic murmur radiating to the axilla.");
    expect(heardIn("Bilateral fine end-inspiratory crackles up to the mid-zones; scattered expiratory wheeze. Dull right base.", "lungs")).toBe(
      "Bilateral fine end-inspiratory crackles up to the mid-zones. Scattered expiratory wheeze.",
    );
    expect(heardIn("Soft, non-tender. No organomegaly. A bruit is audible just above and to the left of the umbilicus.", "bowel")).toBe("A bruit is audible just above and to the left of the umbilicus.");
    expect(heardIn("Respiratory rate 20. Reduced breath sounds and stony dullness at the right base.", "lungs")).toBe("Reduced breath sounds at the right base.");
    // Nothing about sounds in the examination: what a normal one sounds like.
    expect(heardIn("Soft, non-tender. Spleen tip just palpable. No ascites.", "bowel")).toBe("Bowel sounds present and normal.");
  });

  it("turns findings into sound — present things only, never the negatives", () => {
    expect(heartSounds("S3 gallop. Apical pansystolic murmur radiating to the axilla.", 118, true)).toEqual({ kind: "heart", rate: 118, irregular: true, s3: true, murmur: { phase: "systolic", shape: "plateau" } });
    expect(heartSounds("Normal heart sounds; no murmur or rub.", 72, false)).toEqual({ kind: "heart", rate: 72 });
    expect(heartSounds("Ejection systolic murmur at the right second intercostal space.", 80, false).murmur).toEqual({ phase: "systolic", shape: "diamond" });
    expect(breathSounds("Coarse crackles throughout both lung fields.", 30)).toEqual({ kind: "lungs", rate: 30, breath: "vesicular", crackles: "coarse" });
    expect(breathSounds("Reduced breath sounds and stony dullness at the right base", 20)).toMatchObject({ breath: "reduced" });
    expect(breathSounds("Air entry equal; no crackles.", 18)).toEqual({ kind: "lungs", rate: 18, breath: "vesicular" });
    expect(listen("bowel", "Generalised tenderness with board-like rigidity. Bowel sounds absent.", { hr: 120, rr: 24, irregular: false })).toMatchObject({ sound: { activity: "absent" }, abnormal: true });
  });

  it("in a case: follows the patient as they change, credits the examination, and never names the diagnosis", () => {
    const { state, hidden } = play(emAdhf, ["Auscultate the heart", "Listen to the chest"]);
    const heard = state.messages.filter((m) => m.sounds);
    expect(heard).toHaveLength(2);
    expect(heard[0]!.text).toMatch(/^Heart sounds — /);
    expect(heard[0]!.sounds![0]).toMatchObject({ kind: "heart", s3: true, murmur: { phase: "systolic" } });
    expect(heard[1]!.sounds![0]).toMatchObject({ kind: "lungs", crackles: "fine", wheeze: true });
    // Listening is examining that system.
    expect(hidden.exams.cvs).toBeDefined();
    expect(hidden.exams.rs).toBeDefined();
    const diagnosis = emAdhf.truth.diagnosis.toLowerCase();
    for (const m of heard) {
      expect(m.text.toLowerCase()).not.toContain(diagnosis);
      expect(JSON.stringify(m.sounds)).not.toMatch(/failure|mitral|regurg|diagnos/i);
    }
    const debrief = generateDebrief(emAdhf, hidden, state);
    expect(debrief.score.total).toBeGreaterThanOrEqual(0);
  });

  it("works in every case without errors, and is always just sounds", () => {
    for (const def of CASE_LIBRARY) {
      if (def.track === "phone") continue;
      const { state } = play(def, ["Auscultate the heart", "Auscultate the chest", "Bowel sounds"]);
      const heard = state.messages.filter((m) => m.sounds);
      expect(heard, def.id).toHaveLength(3);
      for (const m of heard) expect(m.text, def.id).not.toMatch(/\b(apex|JVP|tender|dullness|organomegaly|liver|spleen)\b/i);
    }
  });
});
