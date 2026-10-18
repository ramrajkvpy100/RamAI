/**
 * What the guided demo's tips offer to send, in the words used where the
 * case is set. Shared by the coach and the tests, which play exactly these
 * lines and check that they win the case.
 */
import type { Country } from "@/engine/countries";

interface Words {
  check: string;
  recheck: string;
  bolus: string;
  drip: string;
  low: string;
}

const WORDS: Record<Country, Words> = {
  IN: { check: "Check RBS", recheck: "Recheck RBS", bolus: "Give 25% dextrose 100 mL IV", drip: "Start 10% dextrose at 100 mL/h", low: "hypoglycaemia" },
  US: { check: "Check glucose", recheck: "Recheck glucose", bolus: "Give D50 50 mL IV", drip: "Start D10 at 100 mL/h", low: "hypoglycemia" },
  UK: { check: "Check CBG", recheck: "Recheck CBG", bolus: "Give 20% glucose 100 mL IV", drip: "Start 10% glucose at 100 mL/h", low: "hypoglycaemia" },
};

export interface DemoScript {
  talk: string;
  check: string;
  bolus: string;
  recheck: string;
  examine: string;
  listen: string;
  plan: string;
  diagnosis: string;
  hint: string;
  opinion: string;
}

export function demoScript(country: Country = "IN"): DemoScript {
  const w = WORDS[country];
  return {
    talk: "What happened? Ask about diabetes, medicines, meals and allergies",
    check: `${w.check} and ECG`,
    bolus: w.bolus,
    recheck: w.recheck,
    examine: "Examine him and check neuro",
    listen: "Listen to the heart",
    plan: `${w.drip}, stop glimepiride and admit`,
    diagnosis: `Diagnosis: ${w.low} from glimepiride`,
    hint: "Hint",
    opinion: "Internal Medicine opinion",
  };
}

/** The tips, in order — what a first-timer who taps every one of them sends. */
export const demoLines = (country: Country = "IN"): string[] => Object.values(demoScript(country));
