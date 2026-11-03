import { after } from "next/server";
import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { requireUser } from "@/server/auth";

import { addExtraPicture, addPicture, keptExtraPictures, missingPictures, picturesAvailable, round } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { RADIOLOGY_ALSO_TRUE, RADIOLOGY_CLUSTERS } from "@/lib/banks/confusable-data";
import { optionTexts, pickOptions } from "@/lib/confusable";
import { EXTRA_ITEMS, extraGroup, RADIOLOGY_BRIEFS, RADIOLOGY_DECKS, RADIOLOGY_MODALITIES, type ExtraModality, type RadiologyBrief } from "@/lib/radiology";
import SINGLES from "@/lib/radiology-singles.json";
import { scanUrl } from "@/lib/scans";
import { MODALITIES, optionsFor, type DrillItem } from "@/lib/practice";
import type { Modality } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Room for the background search for more studies. */
export const maxDuration = 60;

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

const EXTRA: ExtraModality[] = ["mammo", "mri", "fluoro", "nuclear"];
const SPECIAL: ExtraModality[] = ["mammo", "fluoro", "nuclear"];
const Request = z.object({ modality: z.enum(["special", ...RADIOLOGY_MODALITIES, ...EXTRA]).optional(), deck: z.string().max(80).optional() });

type Study = DrillItem & { brief: RadiologyBrief };

/** Mammography, MRI, contrast studies, nuclear medicine: the images kept with the site and those the finder has added, with their own cases. No picture, no study. */
async function extraStudies(modality: ExtraModality): Promise<Study[]> {
  const pool = EXTRA_ITEMS.filter((x) => x.modality === modality);
  // (Grouped for the picker alone: brain against brain, knee against knee.)
  const pickable = pool.map((x) => ({ ...x, group: extraGroup(x) }));
  const make = (id: string, image: string, credit: DrillItem["credit"]): Study | null => {
    const item = pickable.find((x) => x.id === id);
    if (!item || !item.history) return null;
    const { options, answer } = pickOptions(item, pickable, { clusters: RADIOLOGY_CLUSTERS, alsoTrue: RADIOLOGY_ALSO_TRUE });
    return { item: item.id, image, ecg: null, options: optionTexts(options.map((o) => o.label)), answer, key: item.key, keys: options.map((o) => o.key), credit, source: "commons", brief: { history: item.history, question: item.question } };
  };
  const kept = SINGLES.filter((s) => s.modality === modality).map((s) => make(s.item, scanUrl(s.src), { author: s.author, license: s.license, source: s.source }));
  const found = (await keptExtraPictures(modality)).map((r) => make(r.item, `/api/practice/image/${r.id}`, r.credit));
  return [...kept, ...found].filter((x): x is Study => !!x);
}

/** X-ray, CT, ultrasound: every picture in the bank with a request form, and the studies kept with the site (each looked at by a person). */
async function bankStudies(modality: Modality): Promise<Study[]> {
  const r = await round(modality, "spot", "full", undefined, true);
  const banked = r.items.filter((i) => i.image && RADIOLOGY_BRIEFS[i.item]).map((i) => ({ ...i, brief: RADIOLOGY_BRIEFS[i.item]! }));
  const bank = MODALITIES[modality].items;
  const kept = SINGLES.filter((s) => s.modality === modality && RADIOLOGY_BRIEFS[s.item]).map((s): Study => {
    const item = bank.find((b) => b.id === s.item)!;
    const { options, labels, answer } = optionsFor(modality, item);
    return { item: item.id, image: scanUrl(s.src), ecg: null, options: labels, answer, key: item.key, keys: options.map((o) => o.key), credit: { author: s.author, license: s.license, source: s.source }, source: "commons", brief: RADIOLOGY_BRIEFS[s.item]! };
  });
  return [...kept, ...banked];
}

/**
 * POST /api/radiology/round — reporting cases: a request form (history, question) and a real study
 * (freely licensed, never AI-made). By modality, every picture kept; by deck, one picture of each
 * diagnosis, different each set. No AI is called for the answer; the finder works in the background.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Request);
  if (body instanceof Response) return body;
  try {
    // Invited, signed-in doctors only (the pictures and their answers are RamAI's).
    await requireUser();
    if (body.deck) {
      const deck = RADIOLOGY_DECKS.find((d) => d.name === body.deck);
      if (!deck) return ok({ items: [], total: 0 });
      const ids = new Set(deck.ids);
      const bankIn = RADIOLOGY_MODALITIES.filter((m) => MODALITIES[m].items.some((i) => ids.has(i.id)));
      const extraIn = EXTRA.filter((m) => EXTRA_ITEMS.some((x) => x.modality === m && ids.has(x.id)));
      const all = (await Promise.all([...bankIn.map(bankStudies), ...extraIn.map(extraStudies)])).flat().filter((s) => ids.has(s.item));
      const one = new Map<string, Study>();
      for (const s of shuffle(all)) if (!one.has(s.item)) one.set(s.item, s);
      // Those still without a picture are looked for in the background, a few at a time, and aren't shown until found.
      const missing = deck.ids.filter((id) => !one.has(id));
      if (picturesAvailable() && missing.length) {
        after(() =>
          withUsage({ kind: "practice" }, async () => {
            await Promise.all(
              missing.slice(0, 3).map((id) => {
                const bankModality = bankIn.find((m) => MODALITIES[m].items.some((i) => i.id === id));
                return (bankModality ? addPicture(bankModality, id) : addExtraPicture(id)).catch(() => false);
              }),
            );
          }).catch(() => undefined),
        );
      }
      return ok({ items: shuffle([...one.values()]), total: deck.ids.filter((id) => RADIOLOGY_BRIEFS[id] || EXTRA_ITEMS.find((x) => x.id === id)?.history).length });
    }
    if (body.modality === "special" || (EXTRA as string[]).includes(body.modality ?? "")) {
      const modalities = body.modality === "special" ? SPECIAL : ([body.modality] as ExtraModality[]);
      const items = shuffle((await Promise.all(modalities.map(extraStudies))).flat());
      // Whichever of these has no picture yet: a few looked for in the background.
      const have = new Set(items.map((s) => s.item));
      const missing = EXTRA_ITEMS.filter((x) => modalities.includes(x.modality) && x.history && x.search.length && !have.has(x.id));
      if (picturesAvailable() && missing.length) {
        after(() => withUsage({ kind: "practice" }, async () => void (await Promise.all(missing.slice(0, 3).map((x) => addExtraPicture(x.id).catch(() => false))))).catch(() => undefined));
      }
      return ok({ items: items.slice(0, 2000) });
    }
    const modality = body.modality as Modality | undefined;
    if (!modality) return ok({ items: [] });
    const items = shuffle(await bankStudies(modality)).slice(0, 2000);
    // The bank fills in the background: a few more real studies (from Wikimedia Commons, checked) for next time.
    if (picturesAvailable() && items.length < 12) {
      after(() =>
        withUsage({ kind: "practice" }, async () => {
          const ids = (await missingPictures(modality, 4)).filter((x) => RADIOLOGY_BRIEFS[x]);
          await Promise.all(ids.map((id) => addPicture(modality, id).catch(() => false)));
        }).catch(() => undefined),
      );
    }
    return ok({ items, filling: items.length < 12 });
  } catch (err) {
    return handleError(err);
  }
}
