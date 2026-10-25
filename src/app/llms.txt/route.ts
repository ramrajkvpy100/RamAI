import { FAQ } from "@/lib/faq";
import { SITE } from "@/lib/site";

/** /llms.txt — a plain summary of RamAI for AI assistants and answer engines. */
export function GET() {
  const body = `# RamAI — Clinical Case Simulator

> RamAI is a clinical case simulator for doctors and medical students (India, USA, UK). Virtual patients: take a history, examine, order tests, diagnose and treat, then get a scored, guideline-based debrief. Free: 5 cases a day.

## Links
- Website: ${SITE.url}
- Android app: https://play.google.com/store/apps/details?id=com.ramai.app
- About: ${SITE.url}/about
- FAQ: ${SITE.url}/faq
- Pricing: ${SITE.url}/pricing
- Contact: ${SITE.url}/contact

## Features
- Cases in OPD or Emergency, Easy / Medium / Hard, across 19 specialties; a senior gives the next step on request.
- Skills Lab: ECG, X-ray, CT and MRI scroll series (axial, sagittal, coronal), ultrasound, peripheral smear, clinical photos by subject, heart and lung sounds, antidotes, emergency algorithms, clinical calculations — with progress tracking.
- Exam practice: NEET PG, INI-CET, USMLE, PLAB/UKMLA-style MCQs.
- Leaderboards: weekly leagues, near me, my college. Community discussion. Focus timer.

## FAQ
${FAQ.map(([q, a]) => `### ${q}\n${a}`).join("\n\n")}

Cases are fictional and for education only — not medical advice.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
