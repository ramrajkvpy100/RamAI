/**
 * Where each box of a flowchart goes: rows from top to bottom, Yes to the left and No to the right, and a thin reserved
 * lane where a long arrow passes a row, so it never runs through a box. Arrows going back up are loops, drawn at the side.
 * Pure, so it can be tested.
 */
import type { FlowNode } from "./flowcharts";

export interface FlowEdge {
  from: string;
  to: string;
  label?: "Yes" | "No";
  /** Row, column of each point it passes on the way. */
  via: { rank: number; col: number }[];
  back: boolean;
  /** Leaves its box to the side, rather than carrying straight on down. */
  side: boolean;
}
export interface FlowLayout {
  rank: Map<string, number>;
  col: Map<string, number>;
  edges: FlowEdge[];
  ranks: number;
  cols: number;
}

const outs = (n: FlowNode) =>
  n.kind === "question" ? ([[n.yes, "Yes"], [n.no, "No"]] as const) : n.kind === "step" ? ([[n.next, undefined]] as const) : ([] as const);

export function layoutFlow(nodes: readonly FlowNode[]): FlowLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Arrows that go back up the chart.
  const back = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const walk = (id: string) => {
    state.set(id, 1);
    for (const [to] of outs(byId.get(id)!)) {
      if (!to || !byId.has(to)) continue;
      if (state.get(to) === 1) back.add(`${id}>${to}`);
      else if (!state.has(to)) walk(to);
    }
    state.set(id, 2);
  };
  walk(nodes[0]!.id);
  for (const n of nodes) if (!state.has(n.id)) walk(n.id);

  // Rows: each box below everything that leads to it.
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass <= nodes.length; pass++) {
    for (const n of nodes) {
      for (const [to] of outs(n)) {
        if (!to || !byId.has(to) || back.has(`${n.id}>${to}`)) continue;
        rank.set(to, Math.max(rank.get(to)!, rank.get(n.id)! + 1));
      }
    }
  }
  const ranks = Math.max(...rank.values()) + 1;

  // Each row holds its boxes, and a lane for each arrow crossing it.
  interface Item { key: string; desired: number; w: number; col: number }
  const rows: Item[][] = Array.from({ length: ranks }, () => []);
  const col = new Map<string, number>();
  interface Long { from: string; to: string; label?: "Yes" | "No" }
  const links: Long[] = [];
  for (const n of nodes) for (const [to, label] of outs(n)) if (to && byId.has(to)) links.push({ from: n.id, to, label });
  const forward = links.filter((l) => !back.has(`${l.from}>${l.to}`));

  // The longer way down carries straight on, so the chart reads as one spine and stays narrow enough for a phone; the shorter branch steps aside.
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass <= nodes.length; pass++) for (const l of forward) depth.set(l.from, Math.max(depth.get(l.from)!, depth.get(l.to)! + 1));
  const sideLinks = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== "question") continue;
    const kids = forward.filter((l) => l.from === n.id);
    if (kids.length < 2) {
      // Its other arrow loops back: this one is the way on.
      continue;
    }
    const [yes, no] = kids;
    sideLinks.add(depth.get(yes!.to)! >= depth.get(no!.to)! ? `${no!.from}>${no!.to}` : `${yes!.from}>${yes!.to}`);
  }
  const offsetOf = (l: Long) => (sideLinks.has(`${l.from}>${l.to}`) ? 1 : 0);

  const rowPos = new Map<string, number>();
  const place = (r: number) => {
    const wanted: Item[] = [];
    for (const n of nodes) {
      if (rank.get(n.id) !== r) continue;
      const parents = forward.filter((l) => l.to === n.id);
      const near = parents.map((l) => (rowPos.get(`${l.from}>${l.to}`) ?? col.get(l.from) ?? 0) + (rank.get(l.from) === r - 1 ? offsetOf(l) : 0));
      wanted.push({ key: n.id, desired: near.length ? near.reduce((a, b) => a + b, 0) / near.length : 0, w: 1, col: 0 });
    }
    for (const l of forward) {
      const a = rank.get(l.from)!;
      const b = rank.get(l.to)!;
      if (a < r && r < b) {
        const key = `${l.from}>${l.to}`;
        const start = r === a + 1 ? (col.get(l.from) ?? 0) + offsetOf(l) : rowPos.get(key) ?? 0;
        wanted.push({ key: `~${key}`, desired: start, w: 0.2, col: 0 });
      }
    }
    wanted.sort((x, y) => x.desired - y.desired);
    // Keep them apart, then centre the push on where they wanted to be.
    for (const [i, it] of wanted.entries()) it.col = i ? Math.max(it.desired, wanted[i - 1]!.col + (it.w + wanted[i - 1]!.w) / 2) : it.desired;
    const push = wanted.reduce((n, it) => n + it.col - it.desired, 0) / Math.max(1, wanted.length);
    for (const it of wanted) {
      it.col -= push;
      if (it.key.startsWith("~")) rowPos.set(it.key.slice(1), it.col);
      else col.set(it.key, it.col);
    }
    rows[r] = wanted;
  };
  for (let r = 0; r < ranks; r++) place(r);

  const lane = (key: string, r: number) => rows[r]!.find((it) => it.key === `~${key}`)!.col;
  const edges: FlowEdge[] = links.map((l) => {
    const key = `${l.from}>${l.to}`;
    const isBack = back.has(key);
    const via: FlowEdge["via"] = [];
    if (!isBack) for (let r = rank.get(l.from)! + 1; r < rank.get(l.to)!; r++) via.push({ rank: r, col: lane(key, r) });
    return { from: l.from, to: l.to, ...(l.label ? { label: l.label } : {}), via, back: isBack, side: sideLinks.has(key) };
  });

  // From column 0.
  const all = [...col.values(), ...edges.flatMap((e) => e.via.map((v) => v.col))];
  const min = Math.min(...all);
  for (const [k, v] of col) col.set(k, v - min);
  for (const e of edges) for (const v of e.via) v.col -= min;
  return { rank, col, edges, ranks, cols: Math.max(...all) - min + 1 };
}
