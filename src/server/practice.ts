/**
 * Practice drills — pictures to name, kept once found.
 *
 * For each diagnosis in the bank, a picture is found once and kept for everyone: first a real,
 * freely licensed image from Wikimedia Commons that the AI checker agrees shows exactly that
 * diagnosis — never an AI-made one. Up to three per diagnosis,
 * for variety. ECGs RamAI can draw exactly are always available as a drawn tracing. Rounds use only
 * pictures already kept, so they start at once; missing ones are fetched in the background.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { groupOf, MODALITIES, SPOT_COUNT, type DrillItem, type Modality, type PracticeItem, type PracticeMode } from "@/lib/practice";
import type { PictureType } from "@/engine/types";

import { reviewPicture, type PictureBrief } from "./ai-images";
import { db } from "./db";
import { findRealImage, type Credit } from "./real-images";

/** Pictures kept per diagnosis. */
const PER_ITEM = 5;

const TYPE: Record<Modality, PictureType> = { ecg: "photo", xray: "xray", ct: "ct", usg: "usg", smear: "slide", clinical: "photo" };
const STYLE: Partial<Record<Modality, string>> = {
  ecg: "A real 12-lead ECG printed on standard pink-red grid paper at 25 mm/s and 10 mm/mV, photographed flat or scanned: crisp black traces, lead labels only, true electrophysiology.",
  usg: "An original, unannotated ultrasound frame as a radiologist sees it on the scanner: no text labels, arrows or captions naming any structure or finding (machine overlays such as depth scale and calipers are fine). Reject any image whose text names the diagnosis or a finding.",
  clinical: "A real clinical photograph of a patient's skin, eye, mouth, nails or body, as a doctor sees it at the bedside: no text, arrows, labels or captions naming the condition. Reject any image whose text names the diagnosis, and any illustration or drawing.",
  smear: "A real thin peripheral blood smear under oil-immersion light microscopy (×1000), Leishman or Giemsa stain: pink red cells, purple-staining nuclei, true cell sizes and morphology.",
};

/** Pictures past a student's or intern's level — shown to residents and specialists only. */
const ADVANCED_SPOT = new Set([
  "flutter", "svt", "first-degree", "hyperk", "lvh", "long-qt", "lbbb", "rbbb", "wpw", "pericarditis", "paced",
  "miliary", "cavity", "collapse", "copd", "sbo",
  "edh", "sdh", "dissection", "pe", "pancreatitis",
  "ovarian-cyst", "dvt", "free-fluid",
  "spherocytes", "schistocytes", "target", "aml", "cll", "microfilaria", "megaloblastic",
  "posterior-mi", "wellens", "de-winter", "brugada", "lafb", "tca-ecg", "low-voltage", "dextrocardia", "hypothermia-ecg", "mat", "rvh", "hypercal", "hypocal", "digoxin-effect", "early-repol",
  "pneumomediastinum", "ngt-misplaced", "ett-low", "aortic-unfold", "osteosarcoma", "ankylosing", "epiglottitis",
  "tuberculoma", "ivh", "empyema", "ct-bronchiectasis", "intussusception-ct", "hcc", "emphysematous-pyelo", "necrotising-panc", "mesenteric-ischaemia", "orbital-fracture",
  "dermoid", "endometrioma", "molar", "anencephaly", "lung-sliding", "b-lines", "pkd",
  "malariae", "ovale", "howell-jolly", "basophilic-stippling", "teardrop", "burr-cells", "acanthocytes", "elliptocytes", "agglutination", "apml", "hairy-cell", "giant-platelets", "trypanosome", "borrelia", "babesia", "leukoerythroblastic", "pelger", "loa-loa", "basophilia",
]);

/** Kept pictures found to carry labels that name the answer — removed on sight. */
const REMOVED = ["d1d59e4e-398f-4f5b-b3cb-18042b05891a", "19041bed-3818-48f7-899d-7c0b44fc20a7"];
let removed = false;

export const picturesAvailable = () => !!process.env.OPENAI_API_KEY;

interface Row {
  id: string;
  item: string;
  credit: string | null;
  source: "commons" | "ai";
}

function brief(modality: Modality, item: PracticeItem): PictureBrief {
  const m = MODALITIES[modality];
  return { type: TYPE[modality], view: m.kind, describe: modality === "clinical" ? `A real clinical photograph showing ${item.describe}. It must be recognisable as ${item.label} to a doctor; the exact body site and severity don't matter.` : `A teaching ${m.kind} showing ${item.describe}. It must clearly show the classic features: ${item.key}`, topic: item.label, ...(STYLE[modality] ? { style: STYLE[modality] } : {}) };
}

/** Finds (or makes) one more picture of a diagnosis, checked against it, and keeps it. */
export async function addPicture(modality: Modality, itemId: string): Promise<boolean> {
  const item = MODALITIES[modality].items.find((i) => i.id === itemId);
  if (!item || !picturesAvailable()) return false;
  const have = await db.all<{ credit: string | null }>("SELECT credit FROM practice_images WHERE modality = ? AND item = ? AND source = 'commons'", modality, itemId);
  if (have.length >= PER_ITEM) return false;
  const used = have.map((h) => (h.credit ? (JSON.parse(h.credit) as Credit).source : "")).filter(Boolean);
  const p = brief(modality, item);
  const accept = (image: { mime: string; base64: string }) => reviewPicture(image, p).then((r) => r.ok).catch(() => false);
  const kind = MODALITIES[modality].kind;
  let found: { mime: string; base64: string; credit?: Credit; source: "commons" } | null = null;
  // Clinical photos: the plain name first — Commons finds far more for "psoriasis" than for a long phrase.
  const plainName = item.label.replace(/\s*\(.*\)$/, "");
  const real = await findRealImage(modality === "clinical" ? [plainName, ...item.search] : [...item.search, `${item.label} ${kind}`], accept, 25_000, used);
  if (real) found = { ...real, source: "commons" };
  // Practice uses real images only — never AI-made ones. (ECGs RamAI can draw exactly have their tracing besides.)
  if (!found) return false;
  await db.run(
    "INSERT INTO practice_images (id, modality, item, mime, data, credit, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), modality, itemId, found.mime, found.base64, found.credit ? JSON.stringify(found.credit) : null, found.source, Date.now(),
  );
  return true;
}

/** The diagnoses still short of pictures, fewest first — what the background fills next. */
export async function missingPictures(modality: Modality, limit = 3, subject?: string): Promise<string[]> {
  const counts = new Map((await db.all<{ item: string; n: number }>("SELECT item, COUNT(*) AS n FROM practice_images WHERE modality = ? AND source = 'commons' GROUP BY item", modality)).map((r) => [r.item, Number(r.n)]));
  return MODALITIES[modality].items
    .filter((i) => !subject || groupOf(modality, i) === subject)
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
export async function round(modality: Modality, mode: PracticeMode, level: "basic" | "full" = "full", subject?: string): Promise<{ items: DrillItem[]; ready: number; total: number }> {
  // Students and interns: the classic, must-know pictures only.
  const all = MODALITIES[modality].items.filter((i) => level === "full" || !ADVANCED_SPOT.has(i.id));
  // One subject at a time when chosen — its options from the same subject, so they are real look-alikes.
  const bank = subject ? all.filter((i) => groupOf(modality, i) === subject) : all;
  if (!removed) {
    removed = true;
    await db.run(`DELETE FROM practice_images WHERE id IN (${REMOVED.map(() => "?").join(", ")})`, ...REMOVED).catch(() => (removed = false));
  }
  const rows = await db.all<Row>("SELECT id, item, credit, source FROM practice_images WHERE modality = ? AND source = 'commons'", modality);
  const pool: { item: PracticeItem; row: Row | null }[] = [];
  for (const item of bank) {
    const mine = rows.filter((r) => r.item === item.id);
    for (const r of mine) pool.push({ item, row: r });
    if (item.ecg) pool.push({ item, row: null });
  }
  const ready = new Set(pool.map((p) => p.item.id)).size;
  const picked = shuffle(pool).slice(0, mode === "spot" ? SPOT_COUNT : 40);
  const items = picked.map(({ item, row }): DrillItem => {
    const others = shuffle(bank.filter((b) => b.id !== item.id && b.label !== item.label)).slice(0, 3);
    const options = shuffle([item, ...others]);
    return {
      item: item.id,
      image: row ? `/api/practice/image/${row.id}` : null,
      ecg: row ? null : item.ecg!,
      options: options.map((o) => o.label),
      answer: options.indexOf(item),
      key: item.key,
      keys: options.map((o) => o.key),
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
