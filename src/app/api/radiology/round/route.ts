import { after } from "next/server";
import { z } from "zod";

import { withUsage } from "@/engine/providers/usage";
import { requireUser } from "@/server/auth";

import { addPicture, missingPictures, picturesAvailable, round } from "@/server/practice";
import { crossSite, handleError, ok, parseBody, rateLimited } from "@/lib/server/http";
import { EXTRA_ITEMS, RADIOLOGY_BRIEFS, RADIOLOGY_MODALITIES, type ExtraModality } from "@/lib/radiology";
import SINGLES from "@/lib/radiology-singles.json";
import { MODALITIES, type DrillItem } from "@/lib/practice";
import type { Modality } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Room for the background search for more studies. */
export const maxDuration = 60;

const shuffle = <T,>(xs: T[]): T[] => [...xs].sort(() => Math.random() - 0.5);

const EXTRA: ExtraModality[] = ["mammo", "mri", "fluoro", "nuclear"];
const Request = z.object({ modality: z.enum([...RADIOLOGY_MODALITIES, ...EXTRA] as [string, ...string[]]) });

/**
 * POST /api/radiology/round — reporting cases: a request form (history, question) and a real study
 * from the practice bank (freely licensed, never AI-made). Only studies already kept; no AI is called.
 */
export async function POST(req: Request) {
  const blocked = crossSite(req) ?? rateLimited(req, 20);
  if (blocked) return blocked;
  const body = await parseBody(req, Request);
  if (body instanceof Response) return body;
  try {
    // Invited, signed-in doctors only (the pictures and their answers are RamAI's).
    await requireUser();
    // Mammography, MRI, contrast studies, nuclear medicine: the images kept with the site, and their own cases.
    if ((EXTRA as string[]).includes(body.modality)) {
      const pool = EXTRA_ITEMS.filter((x) => x.modality === body.modality);
      const items = shuffle(SINGLES.filter((s) => s.modality === body.modality)).map((s) => {
        const item = pool.find((x) => x.id === s.item)!;
        const options = shuffle([item, ...shuffle(pool.filter((x) => x.id !== item.id)).slice(0, 3)]);
        return { item: item.id, image: s.src, ecg: null, options: options.map((o) => o.label), answer: options.indexOf(item), key: item.key, keys: options.map((o) => o.key), credit: { author: s.author, license: s.license, source: s.source }, source: "commons" as const, brief: { history: item.history, question: item.question } };
      });
      return ok({ items: items.slice(0, 15) });
    }
    const modality = body.modality as Modality;
    const r = await round(modality, "spot");
    const banked = r.items.filter((i) => i.image && RADIOLOGY_BRIEFS[i.item]).map((i) => ({ ...i, brief: RADIOLOGY_BRIEFS[i.item]! }));
    // Studies kept with the site: real Commons images, each looked at by a person before it was kept.
    const bank = MODALITIES[modality].items;
    const kept = SINGLES.filter((s) => s.modality === modality && RADIOLOGY_BRIEFS[s.item]).map((s): DrillItem & { brief: (typeof RADIOLOGY_BRIEFS)[string] } => {
      const item = bank.find((b) => b.id === s.item)!;
      const options = shuffle([item, ...shuffle(bank.filter((b) => b.id !== item.id)).slice(0, 3)]);
      return { item: item.id, image: s.src, ecg: null, options: options.map((o) => o.label), answer: options.indexOf(item), key: item.key, keys: options.map((o) => o.key), credit: { author: s.author, license: s.license, source: s.source }, source: "commons", brief: RADIOLOGY_BRIEFS[s.item]! };
    });
    const items = shuffle([...kept, ...banked]).slice(0, 15);
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
