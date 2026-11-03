/**
 * The Clinical Grove: the medicinal plants behind the focus timer and the rules of the garden. Pure logic and this
 * device's copy of the record (localStorage), so it works offline and for guests. Signed-in doctors also get a copy
 * on their account (/api/focus/grove). Focus XP is its own counter, worked out from the record: it never touches
 * the clinical rating.
 */

export const DURATIONS = [15, 25, 45, 60, 90, 120] as const;
export type Duration = (typeof DURATIONS)[number];

export const PLANT_IDS = ["salix", "digitalis", "cinchona", "artemisia", "papaver", "catharanthus", "atropa", "colchicum", "taxus", "penicillium"] as const;
export type PlantId = (typeof PLANT_IDS)[number];

export const STAGE_IDS = ["seed", "sprout", "sapling", "canopy", "flowering"] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** Where each stage starts, as a share of the session. Flowering is only ever the finished session. */
export const STAGE_FROM: Record<StageId, number> = { seed: 0, sprout: 0.15, sapling: 0.35, canopy: 0.65, flowering: 1 };

const TREE: Record<StageId, string> = { seed: "Seed", sprout: "Sprout", sapling: "Sapling", canopy: "Full canopy", flowering: "Flowering" };
const HERB: Record<StageId, string> = { ...TREE, sapling: "Young plant", canopy: "Full leaf" };

export interface Plant {
  id: PlantId;
  latin: string;
  common: string;
  /** What it gives, in a few words. */
  drug: string;
  /** One true pharmacology pearl. */
  pearl: string;
  /** Completed sessions needed; 0 is open from the start. */
  unlockAt: number;
  /** "plant", or a culture, which is honestly not a tree. */
  kind: "plant" | "culture";
  stages: Record<StageId, string>;
}

export const PLANTS: Record<PlantId, Plant> = {
  salix: {
    id: "salix",
    latin: "Salix alba",
    common: "White willow",
    drug: "Salicin, the lead to aspirin",
    pearl: "Willow bark contains salicin, which the body converts to salicylic acid. That lead gave us aspirin (acetylsalicylic acid), an irreversible COX inhibitor.",
    unlockAt: 0,
    kind: "plant",
    stages: TREE,
  },
  digitalis: {
    id: "digitalis",
    latin: "Digitalis purpurea",
    common: "Foxglove",
    drug: "Cardiac glycosides (digitalis)",
    pearl: "Foxglove gave medicine the cardiac glycosides, which inhibit Na+/K+-ATPase. D. purpurea yields digitoxin; digoxin itself is isolated from its relative, D. lanata.",
    unlockAt: 0,
    kind: "plant",
    stages: HERB,
  },
  cinchona: {
    id: "cinchona",
    latin: "Cinchona officinalis",
    common: "Cinchona",
    drug: "Quinine",
    pearl: "Cinchona bark gives quinine, which kills the blood stages of the malaria parasite. Artesunate does not come from Cinchona: it comes from Artemisia annua.",
    unlockAt: 0,
    kind: "plant",
    stages: TREE,
  },
  artemisia: {
    id: "artemisia",
    latin: "Artemisia annua",
    common: "Sweet wormwood",
    drug: "Artemisinin, the parent of artesunate",
    pearl: "Sweet wormwood gives artemisinin, the parent of artesunate, first-line for severe malaria. Tu Youyou shared the 2015 Nobel Prize for its discovery.",
    unlockAt: 0,
    kind: "plant",
    stages: HERB,
  },
  papaver: {
    id: "papaver",
    latin: "Papaver somniferum",
    common: "Opium poppy",
    drug: "Morphine",
    pearl: "Latex from the opium poppy's unripe capsule gives morphine, a mu-opioid receptor agonist. Naloxone competitively reverses it.",
    unlockAt: 0,
    kind: "plant",
    stages: HERB,
  },
  catharanthus: {
    id: "catharanthus",
    latin: "Catharanthus roseus",
    common: "Madagascar periwinkle",
    drug: "Vincristine, vinblastine",
    pearl: "Madagascar periwinkle gives vincristine and vinblastine, which bind tubulin and block microtubule assembly. Vincristine's dose-limiting toxicity is neuropathy; vinblastine's is myelosuppression.",
    unlockAt: 3,
    kind: "plant",
    stages: HERB,
  },
  atropa: {
    id: "atropa",
    latin: "Atropa belladonna",
    common: "Deadly nightshade",
    drug: "Atropine",
    pearl: "Deadly nightshade gives atropine, a competitive muscarinic antagonist, used for symptomatic bradycardia and organophosphate poisoning.",
    unlockAt: 7,
    kind: "plant",
    stages: HERB,
  },
  colchicum: {
    id: "colchicum",
    latin: "Colchicum autumnale",
    common: "Autumn crocus",
    drug: "Colchicine",
    pearl: "Autumn crocus gives colchicine, which binds tubulin and impairs neutrophil function. It treats acute gout and familial Mediterranean fever, and its therapeutic window is narrow.",
    unlockAt: 15,
    kind: "plant",
    stages: { ...HERB, seed: "Corm" },
  },
  taxus: {
    id: "taxus",
    latin: "Taxus brevifolia",
    common: "Pacific yew",
    drug: "Paclitaxel",
    pearl: "Pacific yew bark gave paclitaxel, which stabilises microtubules and stops them breaking down: the opposite of the vinca alkaloids, with the same arrest in mitosis.",
    unlockAt: 25,
    kind: "plant",
    // A conifer has no flowers: what it finishes with is red arils around its seeds.
    stages: { ...TREE, flowering: "Red arils" },
  },
  penicillium: {
    id: "penicillium",
    latin: "Penicillium chrysogenum",
    common: "Penicillium culture",
    drug: "Penicillin, the first beta-lactam",
    pearl: "A mould, not a tree. P. chrysogenum is the industrial source of penicillin; beta-lactams bind penicillin-binding proteins and block bacterial cell-wall cross-linking.",
    unlockAt: 40,
    kind: "culture",
    stages: { seed: "Spore", sprout: "Germ tube", sapling: "Young colony", canopy: "Full colony", flowering: "Sporulating" },
  },
};

export const isPlantId = (v: unknown): v is PlantId => typeof v === "string" && (PLANT_IDS as readonly string[]).includes(v);

/** The stage at this share of the session (0–1). */
export function stageOf(progress: number): StageId {
  if (progress >= STAGE_FROM.flowering) return "flowering";
  if (progress >= STAGE_FROM.canopy) return "canopy";
  if (progress >= STAGE_FROM.sapling) return "sapling";
  if (progress >= STAGE_FROM.sprout) return "sprout";
  return "seed";
}

/** How far through its own stage this progress is (0–1), for the slow growth inside a stage. */
export function withinStage(progress: number): number {
  const stage = stageOf(progress);
  if (stage === "flowering") return 1;
  const next = STAGE_IDS[STAGE_IDS.indexOf(stage) + 1]!;
  return Math.max(0, (progress - STAGE_FROM[stage]) / (STAGE_FROM[next] - STAGE_FROM[stage]));
}

/** A small sign of the stage, for the widgets. */
export const STAGE_MARK: Record<StageId, string> = { seed: "🌰", sprout: "🌱", sapling: "🌿", canopy: "🌳", flowering: "🌸" };
export const stageMark = (plant: PlantId, stage: StageId) => (plant === "penicillium" ? "🧫" : STAGE_MARK[stage]);

/** The rest after a session: 5 minutes for each half hour, at least 5. */
export const breakMinutes = (focus: number) => Math.max(1, Math.round(focus / 30)) * 5;

/* ---------- The record ---------- */

export interface GroveRecord {
  /** From the session's start time, so the same session can't be recorded twice. */
  id: string;
  plant: PlantId;
  status: "planted" | "withered";
  /** Planted: flowering. Withered: how far it got. */
  stage: StageId;
  /** Minutes actually focused. */
  minutes: number;
  /** Minutes chosen. */
  planned: number;
  at: number;
}

export function plantedRecord(s: { plant: PlantId; minutes: number; startedAt: number; at: number }): GroveRecord {
  return { id: String(s.startedAt), plant: s.plant, status: "planted", stage: "flowering", minutes: s.minutes, planned: s.minutes, at: s.at };
}

export function witheredRecord(s: { plant: PlantId; planned: number; progress: number; startedAt: number; at: number }): GroveRecord {
  // Gave up, so never flowering, however close.
  const stage = stageOf(Math.min(s.progress, 0.999));
  return { id: String(s.startedAt), plant: s.plant, status: "withered", stage, minutes: Math.floor(Math.max(0, s.progress) * s.planned), planned: s.planned, at: s.at };
}

/** Both lists together, each session once, oldest first. */
export function mergeRecords(a: readonly GroveRecord[], b: readonly GroveRecord[]): GroveRecord[] {
  const byId = new Map<string, GroveRecord>();
  for (const r of [...a, ...b]) if (!byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()].sort((x, y) => x.at - y.at);
}

export const plantedOf = (records: readonly GroveRecord[]) => records.filter((r) => r.status === "planted");

/** A calendar day on this phone, as a whole number: safe across daylight-saving changes. */
const dayNumber = (ms: number) => {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

/** Days in a row with at least one completed session. A withered plant doesn't break or build a streak. */
export function streaks(records: readonly GroveRecord[], now = Date.now()): { current: number; longest: number } {
  const days = [...new Set(plantedOf(records).map((r) => dayNumber(r.at)))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const today = dayNumber(now);
  const last = days[days.length - 1];
  // Today not done yet: the streak from yesterday still stands.
  const current = last === today || last === today - 1 ? run : 0;
  return { current, longest };
}

export type Plot = "today" | "week" | "all";

/** Which records fall in a plot. The week starts on Monday. */
export function plotOf(records: readonly GroveRecord[], plot: Plot, now = Date.now()): GroveRecord[] {
  if (plot === "all") return [...records];
  const today = dayNumber(now);
  const from = plot === "today" ? today : today - (new Date(now).getDay() + 6) % 7;
  return records.filter((r) => dayNumber(r.at) >= from && dayNumber(r.at) <= today);
}

export const FIRST_OF_DAY_XP = 10;

/** 1 per minute of completed focus, and a bonus for the first plant of each day. */
export function focusXp(records: readonly GroveRecord[]): number {
  const planted = plantedOf(records);
  return planted.reduce((n, r) => n + r.minutes, 0) + new Set(planted.map((r) => dayNumber(r.at))).size * FIRST_OF_DAY_XP;
}

/** Completed focus only. */
export const focusedMinutes = (records: readonly GroveRecord[]) => plantedOf(records).reduce((n, r) => n + r.minutes, 0);

export const isUnlocked = (plant: PlantId, completed: number) => completed >= PLANTS[plant].unlockAt;
export const unlockedPlants = (completed: number) => PLANT_IDS.filter((p) => isUnlocked(p, completed));
/** The next rare plant still locked, soonest first. */
export function nextUnlock(completed: number): Plant | null {
  return PLANT_IDS.map((p) => PLANTS[p]).filter((p) => p.unlockAt > completed).sort((a, b) => a.unlockAt - b.unlockAt)[0] ?? null;
}

/* ---------- This device's copy ---------- */

const KEY = "ramai.grove.v1";
const EMPTY: GroveRecord[] = [];
const subs = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: GroveRecord[] = EMPTY;

/** The same array until the record changes, so React can subscribe to it. */
export function getGrove(): GroveRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    const list: unknown = raw ? JSON.parse(raw) : EMPTY;
    cached = Array.isArray(list) ? (list as GroveRecord[]).filter((r) => r && isPlantId(r.plant)) : EMPTY;
    return cached;
  } catch {
    return EMPTY;
  }
}
export const emptyGrove = () => EMPTY;

export function setGrove(records: GroveRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {}
  subs.forEach((f) => f());
}

export function addToGrove(record: GroveRecord) {
  setGrove(mergeRecords(getGrove(), [record]));
}

export function subscribeGrove(f: () => void) {
  subs.add(f);
  window.addEventListener("storage", f);
  return () => {
    subs.delete(f);
    window.removeEventListener("storage", f);
  };
}
