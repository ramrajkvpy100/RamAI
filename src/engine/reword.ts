/**
 * No two replies in a chat are word for word the same. Common short lines have other ways of saying them; anything else keeps its
 * facts and says it is being repeated. Fixed tables, with no model, so a case replays exactly.
 */
const OTHER_WAYS: Record<string, string[]> = {
  "Sorry, doctor — could you say that again?": ["I didn't catch that, doctor.", "Could you put that another way, doctor?", "Sorry, I don't follow, doctor.", "I'm not sure what you mean, doctor — please say it differently."],
  "About the same, doctor.": ["No real difference, doctor.", "Much as before, doctor.", "It hasn't really changed, doctor.", "Same as it was, doctor."],
  "Okay, doctor.": ["All right, doctor.", "Yes, doctor.", "Understood, doctor.", "As you say, doctor."],
  "No, doctor.": ["No, not that, doctor.", "Not at all, doctor.", "No, I haven't, doctor.", "Nothing like that, doctor."],
  "Okay, doctor. What next?": ["Done, doctor. What's next?", "Right, doctor. Anything else?", "Yes, doctor. What now?", "Noted, doctor. Your next order?"],
  "Which medicine, dose and route?": ["Please name the medicine, its dose and how it's given.", "I need the drug, the dose and the route.", "What drug should it be, how much, and by which route?", "Still waiting for a drug, a dose and a route."],
  "The patient has died. End the case to review the encounter.": ["No further orders can be carried out: the patient has died. End the case to see the review.", "The patient has passed away. Please end the case.", "Nothing more can be done now. End the case to review it.", "The case is over: the patient has died."],
};

const OPENERS: Record<"speech" | "nurse" | "finding" | "other", string[]> = {
  speech: ["As I told you, doctor: ", "Like I said: ", "I'll say it again, doctor: ", "Same answer, doctor: ", "Yes, as before: "],
  nurse: ["As I said, doctor: ", "Once more, doctor: ", "Repeating that, doctor: ", "Still the same, doctor: ", "Again, doctor: "],
  finding: ["Looked again, no different: ", "Rechecked, unchanged: ", "Once more: ", "On another look: ", "Still: "],
  other: ["Again: ", "Once more: ", "Still: ", "As before: ", "Repeated: "],
};

/** The same message said for the nth time (1 = the first repeat), in different words. */
export function reworded(text: string, role: string, kind: string | undefined, n: number): string {
  const others = OTHER_WAYS[text];
  if (others?.[n - 1]) return others[n - 1]!;
  const set = role === "patient" || role === "attendant" ? OPENERS.speech : role === "nurse" ? OPENERS.nurse : kind === "finding" ? OPENERS.finding : OPENERS.other;
  const opener = set[(n - 1) % set.length]!;
  const rounds = Math.floor((n - 1) / set.length);
  return `${opener}${text}${rounds ? ` (${n + 1} times now)` : ""}`;
}

/** The same again in Hinglish: what the patient and family say. */
export const REWORD_HINGLISH: Record<string, string> = {
  "I didn't catch that, doctor.": "Samajh nahi aaya, doctor.",
  "Could you put that another way, doctor?": "Thoda aur tarah se boliye, doctor?",
  "Sorry, I don't follow, doctor.": "Maaf kijiye, samajh nahi paya, doctor.",
  "I'm not sure what you mean, doctor — please say it differently.": "Pata nahi aap kya keh rahe hain, doctor — kisi aur tarah se boliye.",
  "No real difference, doctor.": "Koi khaas farak nahi, doctor.",
  "Much as before, doctor.": "Pehle jaisa hi hai, doctor.",
  "It hasn't really changed, doctor.": "Kuch khaas badla nahi, doctor.",
  "Same as it was, doctor.": "Waisa hi hai, doctor.",
  "All right, doctor.": "Achha, doctor.",
  "Yes, doctor.": "Ji, doctor.",
  "Understood, doctor.": "Samajh gaya, doctor.",
  "As you say, doctor.": "Jaisa aap kahein, doctor.",
  "No, not that, doctor.": "Nahi, yeh nahi, doctor.",
  "Not at all, doctor.": "Bilkul nahi, doctor.",
  "No, I haven't, doctor.": "Nahi, aisa nahi hua, doctor.",
  "Nothing like that, doctor.": "Aisa kuch nahi, doctor.",
};

export const OPENER_HINGLISH: Record<string, string> = {
  "As I told you, doctor: ": "Jaise maine bataya, doctor: ",
  "Like I said: ": "Jaisa maine kaha: ",
  "I'll say it again, doctor: ": "Phir se bata deta hoon, doctor: ",
  "Same answer, doctor: ": "Jawab wahi hai, doctor: ",
  "Yes, as before: ": "Haan, pehle ki tarah: ",
};
