/** Public "learn" pages: one per diagnosis in the Skills Lab image drills — what it is and how to recognise it. */
import { groupOf, MODALITIES, MODALITY_IDS, type Modality, type PracticeItem } from "./practice";

export interface LearnEntry {
  slug: string;
  modality: Modality;
  group: string;
  item: PracticeItem;
}

const slugify = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let cache: LearnEntry[] | null = null;
export function learnEntries(): LearnEntry[] {
  if (cache) return cache;
  const seen = new Set<string>();
  const out: LearnEntry[] = [];
  for (const m of MODALITY_IDS)
    for (const item of MODALITIES[m].items) {
      let slug = `${slugify(item.label)}-${MODALITIES[m].short.toLowerCase().replace(/[^a-z]/g, "")}`;
      if (seen.has(slug)) slug = `${slug}-${item.id}`;
      seen.add(slug);
      out.push({ slug, modality: m, group: groupOf(m, item), item });
    }
  return (cache = out);
}
export const learnEntry = (slug: string) => learnEntries().find((e) => e.slug === slug);
export const plain = (s: string) => s.replace(/\*\*/g, "");
