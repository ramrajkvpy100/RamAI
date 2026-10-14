/**
 * Practice drills — pictures to name, kept once found.
 *
 * For each diagnosis in the bank, a picture is found once and kept for everyone: first a real,
 * freely licensed image from Wikimedia Commons that the AI checker agrees shows exactly that
 * diagnosis; failing that, an AI-made image that passes the same check. Up to three per diagnosis,
 * for variety. ECGs RamAI can draw exactly are always available as a drawn tracing. Rounds use only
 * pictures already kept, so they start at once; missing ones are fetched in the background.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { MODALITIES, SPOT_COUNT, type DrillItem, type Modality, type PracticeItem, type PracticeMode } from "@/lib/practice";
import type { PictureType } from "@/engine/types";

import { drawPicture, reviewPicture, type PictureBrief } from "./ai-images";
import { db } from "./db";
import { findRealImage, type Credit } from "./real-images";

/** Pictures kept per diagnosis. */
const PER_ITEM = 3;

const TYPE: Record<Modality, PictureType> = { ecg: "photo", xray: "xray", ct: "ct", usg: "usg", smear: "slide" };
const STYLE: Partial<Record<Modality, string>> = {
  ecg: "A real 12-lead ECG printed on standard pink-red grid paper at 25 mm/s and 10 mm/mV, photographed flat or scanned: crisp black traces, lead labels only, true electrophysiology.",
  smear: "A real thin peripheral blood smear under oil-immersion light microscopy (×1000), Leishman or Giemsa stain: pink red cells, purple-staining nuclei, true cell sizes and morphology.",
};

export const picturesAvailable = () => !!process.env.OPENAI_API_KEY;

interface Row {
  id: string;
  item: string;
  credit: string | null;
  source: "commons" | "ai";
}

function brief(modality: Modality, item: PracticeItem): PictureBrief {
  const m = MODALITIES[modality];
  return { type: TYPE[modality], view: m.kind, describe: `A teaching ${m.kind} showing ${item.describe}. It must clearly show the classic features: ${item.key}`, topic: item.label, ...(STYLE[modality] ? { style: STYLE[modality] } : {}) };
}

/** Finds (or makes) one more picture of a diagnosis, checked against it, and keeps it. */
export async function addPicture(modality: Modality, itemId: string): Promise<boolean> {
  const item = MODALITIES[modality].items.find((i) => i.id === itemId);
  if (!item || !picturesAvailable()) return false;
  const have = await db.all<{ credit: string | null }>("SELECT credit FROM practice_images WHERE modality = ? AND item = ?", modality, itemId);
  if (have.length >= PER_ITEM) return false;
  const used = have.map((h) => (h.credit ? (JSON.parse(h.credit) as Credit).source : "")).filter(Boolean);
  const p = brief(modality, item);
  const accept = (image: { mime: string; base64: string }) => reviewPicture(image, p).then((r) => r.ok).catch(() => false);
  const kind = MODALITIES[modality].kind;
  let found: { mime: string; base64: string; credit?: Credit; source: "commons" | "ai" } | null = null;
  const real = await findRealImage([...item.search, `${item.label} ${kind}`], accept, 25_000, used);
  if (real) found = { ...real, source: "commons" };
  // No real one that shows it: an AI-made picture, kept only if the checker passes it too. (Drawn ECGs need neither.)
  if (!found && !item.ecg) {
    const drawn = await drawPicture(p).catch(() => null);
    if (drawn && (await accept(drawn))) found = { ...drawn, source: "ai" };
  }
  if (!found) return false;
  await db.run(
    "INSERT INTO practice_images (id, modality, item, mime, data, credit, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), modality, itemId, found.mime, found.base64, found.credit ? JSON.stringify(found.credit) : null, found.source, Date.now(),
  );
  return true;
}

/** The diagnoses still short of pictures, fewest first — what the background fills next. */
export async function missingPictures(modality: Modality, limit = 3): Promise<string[]> {
  const counts = new Map((await db.all<{ item: string; n: number }>("SELECT item, COUNT(*) AS n FROM practice_images WHERE modality = ? GROUP BY item", modality)).map((r) => [r.item, Number(r.n)]));
  return MODALITIES[modality].items
    .map((i) => ({ id: i.id, n: counts.get(i.id) ?? 0, drawn: !!i.ecg }))
    .filter((i) => i.n < PER_ITEM)
    .sort((a, b) => a.n - b.n || Number(a.drawn) - Number(b.drawn))
    .slice(0, limit)
    .map((i) => i.id);
}

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** A round: every picture already kept (and each drawable ECG), shuffled, with four names to choose from. */
export async function round(modality: Modality, mode: PracticeMode): Promise<{ items: DrillItem[]; ready: number; total: number }> {
  const bank = MODALITIES[modality].items;
  const rows = await db.all<Row>("SELECT id, item, credit, source FROM practice_images WHERE modality = ?", modality);
  const pool: { item: PracticeItem; row: Row | null }[] = [];
  for (const item of bank) {
    const mine = rows.filter((r) => r.item === item.id);
    for (const r of mine) pool.push({ item, row: r });
    if (item.ecg) pool.push({ item, row: null });
  }
  const ready = new Set(pool.map((p) => p.item.id)).size;
  const picked = shuffle(pool).slice(0, mode === "spot" ? SPOT_COUNT : 40);
  const items = picked.map(({ item, row }): DrillItem => {
    const others = shuffle(bank.filter((b) => b.id !== item.id)).slice(0, 3);
    const options = shuffle([item, ...others]);
    return {
      item: item.id,
      image: row ? `/api/practice/image/${row.id}` : null,
      ecg: row ? null : item.ecg!,
      options: options.map((o) => o.label),
      answer: options.indexOf(item),
      key: item.key,
      credit: row?.credit ? (JSON.parse(row.credit) as Credit) : null,
      source: row ? row.source : "drawn",
    };
  });
  return { items, ready, total: bank.length };
}

export async function picture(id: string): Promise<{ mime: string; data: Buffer } | null> {
  const row = await db.get<{ mime: string; data: string }>("SELECT mime, data FROM practice_images WHERE id = ?", id);
  return row ? { mime: row.mime, data: Buffer.from(row.data, "base64") } : null;
}

/** A finished round, for their own record — separate from cases, XP and rank. */
export async function recordRound(userId: string, r: { modality: Modality; mode: PracticeMode; correct: number; total: number }) {
  await db.run("INSERT INTO practice_rounds (user_id, modality, mode, correct, total, created_at) VALUES (?, ?, ?, ?, ?, ?)", userId, r.modality, r.mode, r.correct, r.total, Date.now());
}

export interface PracticeStats {
  modality: Modality;
  rounds: number;
  correct: number;
  total: number;
  /** Best rapid-fire score. */
  best: number;
}

export async function practiceStats(userId: string): Promise<PracticeStats[]> {
  const rows = await db.all<{ modality: Modality; rounds: number; correct: number; total: number; best: number | null }>(
    "SELECT modality, COUNT(*) AS rounds, SUM(correct) AS correct, SUM(total) AS total, MAX(CASE WHEN mode = 'rapid' THEN correct END) AS best FROM practice_rounds WHERE user_id = ? GROUP BY modality",
    userId,
  );
  return rows.map((r) => ({ modality: r.modality, rounds: Number(r.rounds), correct: Number(r.correct), total: Number(r.total), best: Number(r.best ?? 0) }));
}
