"use client";

/** Each Learn module's study sheet, built from the drill's own answers and explanations. */
import radiologyStacks from "@/lib/radiology-stacks.json";
import { HEART, LUNGS } from "@/components/practice/sounds-drill";

import { groupOf, MODALITIES, type Modality } from "./practice";
import { quizReference } from "./skills";

export type Reference = { group: string; items: { title: string; text: string }[] }[];

export function referenceFor(id: string): Reference {
  if (id === "antidotes" || id === "algorithms" || id === "calculations") return quizReference(id);
  if (id === "sounds") return [
    { group: "Heart sounds", items: HEART.map((h) => ({ title: h.label, text: h.key })) },
    { group: "Breath sounds", items: LUNGS.map((l) => ({ title: l.label, text: l.key })) },
  ];
  if (id === "radiology") {
    // The scan series (single pictures are taught in Spot the diagnosis).
    const all = radiologyStacks as { diagnosis: string; key: string; modality?: string }[];
    const groups = new Map<string, { title: string; text: string }[]>();
    for (const r of all) {
      const g = (r.modality ?? "Scans").toUpperCase() === "MR" ? "MRI" : (r.modality ?? "Scans").toUpperCase();
      const title = r.diagnosis;
      if (!title || groups.get(g)?.some((x) => x.title === title)) continue;
      groups.set(g, [...(groups.get(g) ?? []), { title, text: r.key }]);
    }
    return [...groups].map(([group, items]) => ({ group, items }));
  }
  if (id in MODALITIES) {
    const m = id as Modality;
    const groups = new Map<string, { title: string; text: string }[]>();
    for (const item of MODALITIES[m].items) groups.set(groupOf(m, item), [...(groups.get(groupOf(m, item)) ?? []), { title: item.label, text: item.key }]);
    return [...groups].map(([group, items]) => ({ group, items }));
  }
  return [];
}
