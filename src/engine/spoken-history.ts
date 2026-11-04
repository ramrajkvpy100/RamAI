/**
 * A bedside question the case file doesn't cover, answered at once with no model: how the patient is now, or a plain "no" to a
 * symptom. A "no" is only said when it can't be wrong: if the case's own words touch the topic, or the diagnosis commonly brings
 * it, this stays silent and the model, which knows the whole case, answers instead. Fixed tables and a hash: a case replays exactly.
 */
import type { ClinicalCaseDefinition } from "./case-definition";
import type { HiddenState } from "./simulator";

interface Topic {
  /** How the doctor might ask. */
  ask: RegExp;
  /** Words in the case that mean this isn't a simple no. */
  touches: RegExp;
  /** Diagnoses that commonly bring it: the model answers. */
  implied?: RegExp;
  no: string[];
}

const TOPICS: Topic[] = [
  { ask: /\b(fever|temperature|chills?|rigors?|shiver\w*)\b/, touches: /fever|temperature|chill|rigor|shiver|febrile/, implied: /infect|sepsis|septic|pneumon|malaria|dengue|typhoid|enteric|abscess|tubercul|\btb\b|meningit|encephalit|pyelo|cholangit|cholecyst|appendic|cellulit|endocardit|lepto|scrub|covid|influenza|bronchiolit|mening|peritonit|osteomyel|arthritis|lupus|lymphoma|leuk/, no: ["No doctor, I haven't had any fever or chills.", "No fever or shivering that I've noticed, doctor."] },
  { ask: /\b(cough\w*|sputum|phlegm|haemoptysis|hemoptysis)\b/, touches: /cough|sputum|phlegm|haemoptysis|hemoptysis/, implied: /pneumon|asthma|copd|tubercul|\btb\b|bronch|lung|pulmonary|heart failure|oedema|edema|covid|croup/, no: ["No doctor, I haven't had any cough.", "No cough or phlegm, doctor."] },
  { ask: /\b(breathless\w*|short(?:ness)? of breath|sob|dyspn\w*|orthopn\w*|pnd|breathing trouble|difficulty breathing|wake.*breath\w*)\b/, touches: /breath|dyspn|orthopn|gasp|wheez/, implied: /heart failure|asthma|copd|pneumon|embol|anaemia|anemia|pleural|pneumothorax|myocard|infarct|acs\b|angina|anaphyl|acidosis|dka/, no: ["No doctor, my breathing has been fine.", "No breathing trouble, doctor."] },
  { ask: /\b(chest pain|chest discomfort|chest tight\w*|angina)\b/, touches: /chest/, implied: /myocard|infarct|angina|acs\b|embol|dissect|pericard|pneumon|pneumothorax|heart failure|arrhythm|gerd|reflux/, no: ["No doctor, I haven't had any chest pain.", "No pain in the chest, doctor."] },
  { ask: /\b(palpitations?|heart racing|heart pounding)\b/, touches: /palpitat|racing|pounding/, implied: /arrhythm|fibrillat|svt|tachy|thyro|anaemia|anemia|heart failure/, no: ["No doctor, I haven't felt my heart racing.", "No palpitations, doctor."] },
  { ask: /\b(nausea|vomit\w*|throw(?:ing)? up)\b/, touches: /nausea|vomit|throw/, implied: /gastro|appendic|cholecyst|pancrea|obstruct|dka|ketoacid|migraine|mening|poison|hepat|infarct|pregnan|renal colic|stroke|raised icp/, no: ["No doctor, I haven't had any nausea or vomiting.", "No vomiting at all, doctor."] },
  { ask: /\b(loose (?:stools?|motions?)|diarrh\w*|constipat\w*|bowel\w*|stools?|motions?)\b/, touches: /stool|motion|diarrh|constipat|bowel/, implied: /gastro|cholera|enteric|obstruct|crohn|colitis|ibs|cancer|thyro|bleed|ulcer/, no: ["No doctor, my bowels have been normal.", "My motions have been regular, doctor."] },
  { ask: /\b(urine|urinat\w*|burning micturition|dysuria|passing water|bladder)\b/, touches: /urine|urinat|dysuria|micturit|bladder/, implied: /uti\b|cystit|pyelo|renal|kidney|prostat|stone|diabet|dka|aki\b|ckd/, no: ["No doctor, passing urine has been normal.", "No problem with urine, doctor."] },
  { ask: /\b(appetite|eating|weight loss|lost weight|losing weight|weight gain)\b/, touches: /appetite|weight/, implied: /cancer|tubercul|\btb\b|thyro|malign|lymphoma|leuk|hiv|diabet|depress|heart failure|cirrho|carcinoma/, no: ["No doctor, my appetite and weight are the same as usual.", "I'm eating as usual, doctor, and my weight hasn't changed."] },
  { ask: /\b(sleep\w*|insomnia)\b/, touches: /sleep|insomnia/, implied: /depress|anxiety|thyro|apnoea|apnea|heart failure/, no: ["I've been sleeping about as usual, doctor."] },
  { ask: /\b(headaches?|head pain)\b/, touches: /headache|head pain/, implied: /mening|migraine|stroke|haemorrhage|hemorrhage|hypertens|eclamp|tumou?r|glioma|icp|sinus|malaria|dengue/, no: ["No doctor, I haven't had any headache."] },
  { ask: /\b(dizz\w*|giddi\w*|faint\w*|syncope|black(?:ed)? out|lightheaded\w*)\b/, touches: /dizz|giddi|faint|syncop|black/, implied: /arrhythm|block|stenosis|anaemia|anemia|bleed|shock|hypotens|vertigo|stroke|dehydrat|hypoglyc/, no: ["No doctor, no dizziness or fainting."] },
  { ask: /\b(swelling|swollen|oedema|edema|puffy|puffiness)\b/, touches: /swell|swollen|oedema|edema|puffy/, implied: /heart failure|renal|kidney|nephro|cirrho|dvt|thrombosis|cellulit|anaphyl|eclamp|thyro/, no: ["No doctor, no swelling anywhere."] },
  { ask: /\b(rash|itch\w*|skin (?:problem|lesion)s?)\b/, touches: /rash|itch|lesion|skin/, implied: /dengue|measles|allerg|anaphyl|derm|lupus|scabies|tinea|psoria|meningo|drug reaction/, no: ["No doctor, no rash or itching."] },
  { ask: /\b(joint pains?|joints?|back pain)\b/, touches: /joint|back/, implied: /arthrit|gout|lupus|dengue|chikungunya|disc|cauda|pyelo|renal colic|dissect/, no: ["No doctor, no joint or back pain."] },
  { ask: /\b(bleed\w*|blood in|black stools?|melena)\b/, touches: /bleed|blood|melena|malena/, implied: /ulcer|dengue|varice|cirrho|cancer|haemorrh|hemorrh|anaemia|anemia|itp|warfarin|anticoag|abruption|placenta|ectopic|miscarr/, no: ["No doctor, I haven't noticed any bleeding."] },
  { ask: /\b(travel\w*)\b/, touches: /travel|trip|journey|visit/, implied: /malaria|dengue|typhoid|enteric|lepto|scrub|dvt|embol/, no: ["No doctor, I haven't travelled anywhere recently."] },
  { ask: /\b(family history|anyone in (?:the|your) family|run in (?:the|your) family|family members?)\b/, touches: /family|father|mother|brother|sister/, no: ["No doctor, nothing like this in the family that I know of."] },
  { ask: /\b(operat\w*|surger\w*|surgical)\b/, touches: /operat|surger|stent|bypass|section/, no: ["No doctor, I've never had an operation."] },
  { ask: /\b(smok\w*|cigarettes?|bidis?|tobacco|gutkha)\b/, touches: /smok|cigar|bidi|tobacco|gutkha|pack/, implied: /copd|lung cancer|buerger|myocard/, no: ["No doctor, I don't smoke or use tobacco."] },
  { ask: /\b(alcohol|drink(?:ing)?|liquor)\b/, touches: /alcohol|drink|liquor|peg/, implied: /pancreatit|cirrho|alcohol|varice|wernicke/, no: ["No doctor, I don't drink."] },
  { ask: /\b(allerg\w*)\b/, touches: /allerg/, implied: /anaphyl|allerg/, no: ["No doctor, I don't have any allergies that I know of."] },
  { ask: /\b(medicines?|medications?|tablets?|pills?|drugs? you take|taking any)\b/, touches: /tablet|medicine|medication|taking|pill|insulin|inhaler/, no: ["No doctor, I'm not taking any regular medicines."] },
];

const CHECK_IN = /\b(how (?:are|r) (?:you|u)|how do you feel|how are you feeling|feeling (?:now|better)|any (?:better|relief|improvement)|better now|is (?:your|the|it) .{0,20}(?:better|worse|improv\w*))\b/;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (xs: string[], seed: string) => xs[hash(seed) % xs.length]!;

function caseWords(def: ClinicalCaseDefinition): string {
  return [def.briefing, ...def.opening.map((o) => o.text), ...def.history.flatMap((h) => [h.reply, h.fact ?? "", h.label])].join(" ").toLowerCase();
}

/** The reply, or null when this isn't for a table to answer. */
export function instantAnswer(text: string, def: ClinicalCaseDefinition, hidden: HiddenState): string | null {
  const t = text.trim().toLowerCase();
  if (t.length > 120 || def.guided) return null;
  if (/\b(dick|cock|penis|boobs?|breasts?)\b.{0,12}\bsize\b|\bsize of (?:your|ur) (dick|cock|penis|boobs?|breasts?)\b/.test(t)) return "Why would you ask me that, doctor? It has nothing to do with why I came.";
  if (CHECK_IN.test(t)) {
    if (hidden.status === "improving" || hidden.status === "recovered") return pick(["Better than when I came in, doctor.", "A good bit better, doctor, thank you.", "It's easing now, doctor."], `${t}${hidden.clock}`);
    if (hidden.status === "deteriorating" || hidden.status === "critical") return pick(["It's getting worse, doctor.", "Not good, doctor, I feel worse.", "Please, doctor, it's getting harder."], `${t}${hidden.clock}`);
    return pick(["About the same, doctor.", "No real change yet, doctor.", "Much as before, doctor."], `${t}${hidden.clock}`);
  }
  // A question that asks about one thing only: two topics may need different answers.
  const asked = TOPICS.filter((topic) => topic.ask.test(t));
  if (asked.length !== 1) return null;
  const topic = asked[0]!;
  const truth = `${def.truth.diagnosis} ${def.truth.qualifier ?? ""}`.toLowerCase();
  if (topic.touches.test(caseWords(def)) || topic.implied?.test(truth)) return null;
  return pick(topic.no, `${t}${def.id}`);
}
