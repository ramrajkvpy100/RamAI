/**
 * Hinglish rendering of patient and family speech — server-only, so translations
 * of lines the player hasn't elicited never reach the browser. The doctor's
 * side, nursing notes, findings and all teaching stay in English.
 */
import "server-only";

import { capitalise } from "../text";
import type { CaseState, PatientIdentity, PatientLang, TurnEffect } from "../types";
import { CASE_LINES } from "./hinglish-lines";

type Speaker = "patient" | "attendant";

const GLOBAL = CASE_LINES["global-templates"] ?? {};

const FIXED: Record<string, string> = {
  "No, doctor.": "Nahi, doctor.",
  "Okay, doctor.": "Theek hai, doctor.",
  "No, nothing like that.": "Nahi, aisa kuch nahi.",
  "Not that I've noticed.": "Maine toh dhyan nahi diya.",
  "No, I don't think so.": "Nahi, mujhe aisa nahi lagta.",
  "I'm not sure, doctor.": "Pakka nahi pata, doctor.",
  "Just normal home food, doctor. Nothing special.": "Bas ghar ka normal khana, doctor. Kuch khaas nahi.",
  "I don't really know, doctor.": "Mujhe theek se nahi pata, doctor.",
  "Hmm… I can't say, doctor.": "Hmm… kehna mushkil hai, doctor.",
  "Sorry, doctor — I didn't quite follow.": "Sorry doctor — theek se samajh nahi aaya.",
  "Better than before, doctor.": "Pehle se better hai, doctor.",
  "A little better, I think.": "Thoda better lag raha hai.",
  "I'm feeling worse, doctor.": "Aur bura lag raha hai, doctor.",
  "(Too unwell to answer.)": "(Jawab dene ki halat mein nahi.)",
  "About the same, doctor.": "Waisa hi hai, doctor.",
  "I've continued everything as you said, doctor. It's about the same as last time.": "Aapne jaise kaha tha, maine sab jaari rakha, doctor. Pichhli baar jaisa hi hai.",
  "Honestly, doctor, it's no better.": "Sach kahun doctor, koi farak nahi pada.",
  "We don't have any machines at home, doctor.": "Ghar pe koi machine nahi hai, doctor.",
  "Doctor, we can't give injections or drips at home.": "Doctor, ghar pe injection ya drip nahi de sakte.",
  "Okay, doctor — we'll bring them to the hospital now.": "Theek hai doctor — abhi hospital le aate hain.",
  "Doctor, we're at home — should we bring them to the hospital?": "Doctor, hum ghar pe hain — hospital le aayein?",
  "Okay, doctor — we'll look after them at home.": "Theek hai doctor — ghar pe dhyan rakhenge.",
  "Doctor, we're at home — we can't do that here. Should we bring them to the hospital?": "Doctor, hum ghar pe hain — yahan ye nahi ho sakta. Hospital le aayein?",
  "Which medicine do you mean, doctor? Please tell me again — the name, how much and how to give it.": "Kaunsi dawai, doctor? Phir se bata dijiye — naam, kitni aur kaise deni hai.",
  "Good morning, doctor.": "Good morning, doctor.",
  "Namaste, doctor.": "Namaste, doctor.",
  "Hello, doctor.": "Hello, doctor.",
  // What patients say as a drug acts (pharmacology.ts), and when they're just there.
  "The pain has eased a lot, doctor.": "Dard kaafi kam ho gaya hai, doctor.",
  "I need to pass urine, doctor.": "Peshab jaana hai, doctor.",
  "I feel a little cooler now, doctor.": "Ab thoda thanda lag raha hai, doctor.",
  "The pain is better than before.": "Dard pehle se kam hai.",
  "The cramps have settled a bit.": "Marod thodi kam ho gayi hai.",
  "The pain is a bit better.": "Dard thoda kam hai.",
  "The vomiting feeling has settled, doctor.": "Ulti jaisa lagna band ho gaya, doctor.",
  "The itching is much less now — I feel a bit sleepy.": "Khujli ab bahut kam hai — thodi neend si aa rahi hai.",
  "The itching has settled down.": "Khujli shaant ho gayi hai.",
  "I'm here, doctor.": "Main yahin hoon, doctor.",
};

/** Lines the engine composes itself (fallbacks, identity, counselling, phone). */
function generic(text: string, speaker: Speaker, p: PatientIdentity): string | undefined {
  if (FIXED[text]) return FIXED[text];
  const female = p.sex === "Female";
  const self = speaker === "patient";
  const g = (m: string, f: string) => (female ? f : m);

  switch (text) {
    case "Okay, doctor. I'll do that.":
      return self ? `Theek hai doctor, main aisa hi ${g("karunga", "karungi")}.` : "Theek hai doctor, hum aisa hi karenge.";
    case "Okay, doctor. I'll avoid it.":
      return self ? `Theek hai doctor, main isse ${g("bachunga", "bachungi")}.` : "Theek hai doctor, hum iska dhyan rakhenge.";
    case "Okay, doctor. I understand.":
      return self ? `Theek hai doctor, samajh ${g("gaya", "gayi")}.` : "Theek hai doctor, samajh gaye.";
    case "I'm at home these days, doctor.":
      return `Aajkal ghar pe hi ${g("rehta", "rehti")} hoon, doctor.`;
  }

  let m: RegExpMatchArray | null;
  if ((m = text.match(/^I'm (\d+), doctor\.$/))) return `${m[1]} saal, doctor.`;
  if ((m = text.match(/^(\d+) years old, doctor\.$/))) return `${m[1]} saal ${g("ke", "ki")} hain, doctor.`;
  if (text === "One year old, doctor.") return `Ek saal ${g("ka", "ki")} hai, doctor.`;
  if ((m = text.match(/^About (\d+(?:\.\d+)?) out of 10, doctor\.$/))) return `Das mein se lagbhag ${m[1]}, doctor.`;
  if ((m = text.match(/^We only have (.+) at home, doctor( — I can't check the rest)?\.$/))) {
    const devices = m[1]!.split(" and ").map((d) => d.replace(/^an? /, "")).join(" aur ");
    return `Ghar pe sirf ${devices} hai, doctor${m[2] ? " — baaki check nahi kar sakte" : ""}.`;
  }
  if ((m = text.match(/^The machine shows (.+)\.$/))) return `Machine mein ${m[1]} aa raha hai.`;
  if ((m = text.match(/^Doctor, how much (.+) should we give(, and how often)?(, and for how many days)?\?$/))) {
    return `Doctor, ${m[1]} kitna dena hai${m[2] ? ", aur din mein kitni baar" : ""}${m[3] ? ", aur kitne din tak" : ""}?`;
  }
  if ((m = text.match(/^Doctor, should we give the (.+?) (by mouth|under the tongue|in the back passage|by inhaler|by nebuliser|on the skin|in the nose)(?:, )?(.*?)(, and how often)?(, and for how many days)?\?$/))) {
    const lay: Record<string, string> = { "by mouth": "khila dein", "under the tongue": "jeebh ke neeche rakhein", "in the back passage": "peeche se dein", "by inhaler": "inhaler se dein", "by nebuliser": "nebuliser se dein", "on the skin": "skin pe lagayein", "in the nose": "naak mein dein" };
    const ways = text.match(/by mouth|under the tongue|in the back passage|by inhaler|by nebuliser|on the skin|in the nose/g) ?? [];
    return `Doctor, ${m[1]} ${ways.map((w) => lay[w]).join(" ya ")}${m[4] ? ", aur din mein kitni baar" : ""}${m[5] ? ", aur kitne din tak" : ""}?`;
  }
  if ((m = text.match(/^Doctor, how often should we give the (.+?)(, and for how many days)?\?$/))) return `Doctor, ${m[1]} din mein kitni baar dena hai${m[2] ? ", aur kitne din tak" : ""}?`;
  if ((m = text.match(/^Doctor, for how many days should we give the (.+)\?$/))) return `Doctor, ${m[1]} kitne din tak dena hai?`;
  if ((m = text.match(/^Okay, doctor — (he's|she's|they're) taking the (.+) now\.$/))) {
    return `Theek hai doctor — abhi ${m[2]} le ${m[1] === "she's" ? "rahi" : "rahe"} hain.`;
  }
  if (p.occupation && text === `${capitalise(p.occupation)}, doctor.`) return self ? `Main ${p.occupation.toLowerCase()} hoon, doctor.` : `${capitalise(p.occupation)} hain, doctor.`;
  if (text === `${p.city}, doctor.`) return `${p.city} se, doctor.`;
  if (p.name && text === `${p.name}, doctor.`) return self ? `Mera naam ${p.name} hai, doctor.` : text;
  return undefined;
}

export function toHinglish(text: string, caseId: string, speaker: Speaker, patient: PatientIdentity): string {
  return CASE_LINES[caseId]?.[text] ?? GLOBAL[text] ?? generic(text, speaker, patient) ?? text;
}

const spoken = (role: string, kind: string): role is Speaker => kind === "speech" && (role === "patient" || role === "attendant");

export function localizeState(state: CaseState, caseId: string, lang: PatientLang): CaseState {
  if (lang !== "hinglish") return { ...state, lang: "en" };
  return {
    ...state,
    lang,
    messages: state.messages.map((m) => (spoken(m.role, m.kind) ? { ...m, text: toHinglish(m.text, caseId, m.role, state.patient) } : m)),
  };
}

export function localizeEffects(effects: TurnEffect[], caseId: string, patient: PatientIdentity, lang: PatientLang): TurnEffect[] {
  if (lang !== "hinglish") return effects;
  return effects.map((e) => (e.type === "message" && spoken(e.role, e.kind) ? { ...e, text: toHinglish(e.text, caseId, e.role, patient) } : e));
}
