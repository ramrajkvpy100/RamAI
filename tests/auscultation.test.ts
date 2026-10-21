import { describe, expect, it } from "vitest";

import { breathSounds, heardIn, heartSounds, listen, LISTEN_LINE } from "@/engine/auscultation";
import { CASE_LIBRARY } from "@/engine/cases";
import { emAdhf } from "@/engine/cases/em-adhf";
import { generateDebrief } from "@/engine/debrief";
import { simulateCase, stethoscopeSounds, submitDoctorAction } from "@/engine/engine";
import { resolveIntents } from "@/engine/intent";
import { renderAuscultation, SAMPLE_RATE, LISTEN_SECONDS, toWav } from "@/engine/stethoscope-audio";

import { play } from "./helpers";

process.env.RAMAI_SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";

/** Words that would give away what the stethoscope picks up. */
const SOUND_WORDS = /\b(murmur|gallop|S3|S4|crackles?|crepitations?|wheez\w*|stridor|rub|bruit|tinkling|bronchial|vesicular|air entry|breath sounds (?:are|were)|heart sounds (?:are|were)|bowel sounds (?:are|were|present|absent|sluggish|hyperactive)|muffled|soft heart|normal heart|regurg\w*|systolic|diastolic)\b/i;

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

  it("in a case: a stethoscope and nothing else — the sound follows the patient, the words never name it", () => {
    const { state, hidden } = play(emAdhf, ["Auscultate the heart", "Listen to the chest"]);
    const heard = state.messages.filter((m) => m.stethoscope);
    expect(heard).toHaveLength(2);
    expect(heard[0]!.text).toBe("Heart sounds — Stethoscope over the heart — listen.");
    expect(heard[0]!.stethoscope).toEqual(["heart"]);
    expect(heard[1]!.stethoscope).toEqual(["lungs"]);
    // The acoustic parameters stay on the server (the engine strips them before the browser).
    expect(heard[0]!.sounds![0]).toMatchObject({ kind: "heart", s3: true, murmur: { phase: "systolic" } });
    expect(heard[1]!.sounds![0]).toMatchObject({ kind: "lungs", crackles: "fine", wheeze: true });
    for (const m of heard) expect(m.text).not.toMatch(SOUND_WORDS);
    // Listening is examining that system; what was heard is kept for the debrief.
    expect(hidden.exams.cvs).toBeDefined();
    expect(hidden.exams.rs).toBeDefined();
    expect(hidden.heard.map((h) => h.part)).toEqual(["heart", "lungs"]);
    const debrief = generateDebrief(emAdhf, hidden, state);
    expect(debrief.auscultation?.find((a) => a.area === "heart")).toMatchObject({ listened: true, heard: expect.stringMatching(/S3|murmur/i) });
  });

  it("a whole examination says what's seen and felt — and leaves what's heard to the stethoscope", () => {
    const { state } = play(emAdhf, ["Examine CVS", "Examine the chest", "Examine abdomen"]);
    const exams = state.messages.filter((m) => m.kind === "finding" && m.stethoscope);
    expect(exams).toHaveLength(3);
    expect(exams[0]!.text).toContain(LISTEN_LINE.heart);
    expect(exams[1]!.text).toContain(LISTEN_LINE.lungs);
    expect(exams[2]!.text).toContain(LISTEN_LINE.bowel);
    // The rest of the examination is still there.
    expect(exams[0]!.text).toMatch(/apex|JVP|pulse/i);
    for (const m of exams) expect(m.text.replace(/(Heart|Breath|Bowel) sounds: listen with the stethoscope\./g, "")).not.toMatch(SOUND_WORDS);
  });

  it("debrief: names what was heard, and flags what wasn't listened to", () => {
    const { state, hidden } = play(emAdhf, ["Listen to the chest"]);
    const review = generateDebrief(emAdhf, hidden, state).auscultation!;
    expect(review.find((a) => a.area === "lungs")).toMatchObject({ listened: true });
    expect(review.find((a) => a.area === "heart")).toMatchObject({ listened: false, heard: expect.stringMatching(/S3|murmur/i) });
  });

  it("works in every case without errors, and is always just sounds", () => {
    for (const def of CASE_LIBRARY) {
      if (def.track === "phone") continue;
      const { state } = play(def, ["Auscultate the heart", "Auscultate the chest", "Bowel sounds"]);
      const heard = state.messages.filter((m) => m.stethoscope);
      expect(heard, def.id).toHaveLength(3);
      for (const m of heard) {
        expect(m.sounds, def.id).toHaveLength(1);
        expect(m.text, def.id).not.toMatch(SOUND_WORDS);
        expect(m.text, def.id).not.toMatch(/\b(apex|JVP|tender|dullness|organomegaly|liver|spleen)\b/i);
      }
      // Whole examinations never describe sounds either.
      const exams = play(def, ["Examine CVS", "Examine the chest", "Examine abdomen"]).state.messages.filter((m) => m.stethoscope);
      for (const m of exams) expect(m.text.replace(/(Heart|Breath|Bowel) sounds: listen with the stethoscope\./g, ""), def.id).not.toMatch(SOUND_WORDS);
    }
  }, 20_000); // every case, six examinations each: slow on a busy machine
});

describe("through the engine — the browser gets a stethoscope, not a description", () => {
  it("strips the acoustic parameters from what the browser sees; the server can still render them", async () => {
    // The demo case: always the same patient, so the test never depends on which case is picked.
    const start = await simulateCase({ userId: "u-steth", caseNumber: 1, tutorial: true });
    const turn = await submitDoctorAction(start.token, "Auscultate the heart", "u-steth");
    const msg = turn.state.messages.find((m) => m.stethoscope);
    expect(msg).toBeDefined();
    expect(JSON.stringify(turn.state)).not.toMatch(/"sounds"|"s3"|"murmur"/);
    expect(JSON.stringify(turn.effects)).not.toMatch(/"sounds"|"s3"|"murmur"/);
    const sounds = await stethoscopeSounds(turn.token, "u-steth", msg!.id);
    expect(sounds?.[0]).toMatchObject({ kind: "heart" });
    // Someone else's token, or a message without a stethoscope: nothing.
    await expect(stethoscopeSounds(turn.token, "someone-else", msg!.id)).rejects.toThrow();
    expect(await stethoscopeSounds(turn.token, "u-steth", "m1")).toBeNull();
  });
});

describe("the stethoscope's sound", () => {
  const energy = (x: Float32Array) => x.reduce((a, v) => a + v * v, 0) / x.length;

  it("renders twelve seconds of audible, unclipped sound, the same every time for the same seed", () => {
    const sound = renderAuscultation([{ kind: "heart", rate: 72 }], 42);
    expect(sound.length).toBe(SAMPLE_RATE * LISTEN_SECONDS);
    expect(energy(sound)).toBeGreaterThan(1e-4);
    expect(sound.reduce((a, v) => Math.max(a, Math.abs(v)), 0)).toBeLessThanOrEqual(1);
    expect(renderAuscultation([{ kind: "heart", rate: 72 }], 42)).toEqual(sound);
  });

  it("sounds different when the findings are different", () => {
    const normal = renderAuscultation([{ kind: "heart", rate: 72 }], 7);
    const murmur = renderAuscultation([{ kind: "heart", rate: 72, murmur: { phase: "systolic", shape: "plateau" } }], 7);
    const diff = normal.reduce((a, v, i) => a + (v - murmur[i]!) ** 2, 0) / normal.length;
    expect(diff).toBeGreaterThan(1e-5);
    const clear = renderAuscultation([{ kind: "lungs", rate: 16, breath: "vesicular" }], 7);
    const silent = renderAuscultation([{ kind: "lungs", rate: 16, breath: "absent" }], 7);
    expect(energy(silent)).toBeLessThan(energy(clear) / 10);
    const quiet = renderAuscultation([{ kind: "bowel", rate: 80, activity: "absent" }], 7);
    const busy = renderAuscultation([{ kind: "bowel", rate: 80, activity: "hyperactive" }], 7);
    expect(energy(busy)).toBeGreaterThan(energy(quiet) * 10);
  });

  it("is a playable WAV", () => {
    const wav = toWav(renderAuscultation([{ kind: "lungs", rate: 18, breath: "vesicular", wheeze: true }], 3));
    const text = (a: number, b: number) => String.fromCharCode(...wav.slice(a, b));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 12)).toBe("WAVE");
    const v = new DataView(wav.buffer);
    expect(v.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(v.getUint32(40, true)).toBe(SAMPLE_RATE * LISTEN_SECONDS * 2);
    expect(wav.length).toBeLessThan(300_000);
  });
});
