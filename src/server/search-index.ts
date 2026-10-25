/** Everything searchable in RamAI, as one small list the search box filters on the phone (instant, no round trip). */
import { EXAMS } from "@/lib/exams";
import { FAQ } from "@/lib/faq";
import { learnEntries } from "@/lib/learn";
import { MODALITIES } from "@/lib/practice";
import { QUIZ_STEMS } from "@/lib/skills";

export interface SearchItem {
  /** Title. */
  t: string;
  /** Where it is (shown small). */
  s: string;
  /** Link. */
  h: string;
  /** Extra words that should find it. */
  k?: string;
}

const PAGES: SearchItem[] = [
  { t: "New case", s: "Cases", h: "/cases", k: "start case play patient simulator learning mode real life any case opd emergency phone" },
  { t: "Daily case", s: "Cases", h: "/", k: "today daily" },
  { t: "Skills Lab", s: "Practice", h: "/practice", k: "drills practice" },
  { t: "Spot the diagnosis", s: "Skills Lab", h: "/practice?drill=spot", k: "ecg x-ray xray ct ultrasound blood smear clinical images" },
  { t: "Radiology reporting", s: "Skills Lab", h: "/practice?drill=radiology", k: "ct mri scans windows" },
  { t: "Heart & breath sounds", s: "Skills Lab", h: "/practice?drill=sounds", k: "auscultation murmur stethoscope crackles wheeze" },
  { t: "Antidotes", s: "Skills Lab", h: "/practice?drill=antidotes", k: "poisoning toxicology" },
  { t: "Emergency algorithms", s: "Skills Lab", h: "/practice?drill=algorithms", k: "acls bls resuscitation" },
  { t: "Clinical calculations", s: "Skills Lab", h: "/practice?drill=calculations", k: "dose fluids score" },
  { t: "Exam MCQs", s: "Exams", h: "/exams", k: "mcq questions pyq" },
  { t: "Focus timer", s: "Pomodoro", h: "/focus", k: "pomodoro study timer cafe street flowmodoro chai" },
  { t: "Leaderboard", s: "Rankings", h: "/leaderboard", k: "rank near me college" },
  { t: "Community", s: "Doctors", h: "/community", k: "groups friends" },
  { t: "Progress", s: "You", h: "/progress", k: "stats rating" },
  { t: "Revision deck", s: "You", h: "/revision", k: "saved pearls cards" },
  { t: "Achievements", s: "You", h: "/achievements", k: "badges" },
  { t: "Profile & settings", s: "You", h: "/profile", k: "reminder notifications language country bio picture" },
  { t: "Duel a friend", s: "Cases", h: "/duel", k: "two player versus" },
  { t: "Learn: diagnoses", s: "Library", h: "/learn", k: "topics" },
  { t: "Pricing", s: "RamAI Pro", h: "/pricing", k: "pro subscription" },
  { t: "Support RamAI", s: "Donate", h: "/support", k: "donate" },
  { t: "Report or suggest", s: "Help", h: "/suggestions", k: "feedback bug" },
  { t: "Help & FAQ", s: "Help", h: "/faq", k: "questions" },
];

let cache: SearchItem[] | null = null;
export function searchIndex(): SearchItem[] {
  if (cache) return cache;
  const out = [...PAGES];
  for (const e of learnEntries()) out.push({ t: e.item.label, s: `${MODALITIES[e.modality].short} · ${e.group}`, h: `/learn/${e.slug}` });
  const stems = QUIZ_STEMS();
  for (const a of stems.antidotes) out.push({ t: a.stem.slice(0, 90), s: `Antidotes · ${a.cat}`, h: "/practice?drill=antidotes" });
  for (const a of stems.algorithms) out.push({ t: a.stem.slice(0, 90), s: `Algorithms · ${a.cat}`, h: "/practice?drill=algorithms" });
  for (const x of Object.values(EXAMS)) {
    out.push({ t: x.label, s: "Exam practice", h: `/exams/${x.id}` });
    for (const sub of x.subjects) out.push({ t: `${sub}`, s: `${x.label} MCQs`, h: `/exams/${x.id}?subject=${encodeURIComponent(sub)}` });
  }
  FAQ.forEach(([q]) => out.push({ t: q, s: "FAQ", h: "/faq" }));
  return (cache = out);
}
