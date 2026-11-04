import { describe, expect, it } from "vitest";
import { isPersona, parseAvatar, personaParts } from "@/lib/avatar-style";

import { comboMultiplier, xpFor, GAME_XP_CAP } from "@/lib/games/score";
import { CLUE_POINTS, PROBE_CASES } from "@/lib/games/probe";
import { checkTiles, shuffledTiles, SYNAPSE_BOARDS } from "@/lib/games/synapses";
import { flashcardsFrom, FLOWCHARTS } from "@/lib/tools/flowcharts";
import { MNEMONICS, phraseParts } from "@/lib/tools/mnemonics";
import { RESEARCH } from "@/lib/tools/research";
import { layoutFlow } from "@/lib/tools/flow-layout";
import { PLAYLISTS } from "@/lib/tools/playlists";

describe("Synapses boards", () => {
  it("at least 25 boards, each 16 different tiles in 4 groups of 4", () => {
    expect(SYNAPSE_BOARDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(SYNAPSE_BOARDS.map((b) => b.id)).size).toBe(SYNAPSE_BOARDS.length);
    for (const b of SYNAPSE_BOARDS) {
      expect(b.groups).toHaveLength(4);
      const tiles = b.groups.flatMap((g) => g.tiles);
      expect(new Set(tiles).size, b.id).toBe(16);
      expect(shuffledTiles(b, 7).sort()).toEqual([...tiles].sort());
    }
  });

  it("knows a right group, one away, and a wrong guess", () => {
    const b = SYNAPSE_BOARDS[0]!;
    expect(checkTiles(b, b.groups[2]!.tiles).tier).toBe("Hard");
    const oneAway = [...b.groups[0]!.tiles.slice(0, 3), b.groups[1]!.tiles[0]];
    expect(checkTiles(b, oneAway)).toMatchObject({ group: null, closest: 3 });
  });
});

describe("Probe mysteries", () => {
  it("5 clues and 6 different diagnoses each, falling points", () => {
    expect(PROBE_CASES.length).toBeGreaterThanOrEqual(15);
    expect([...CLUE_POINTS]).toEqual([500, 400, 300, 200, 100]);
    for (const c of PROBE_CASES) {
      expect(c.clues).toHaveLength(5);
      expect(new Set([c.answer, ...c.decoys]).size, c.id).toBe(6);
      // The answer isn't given away before the end.
      for (const clue of c.clues.slice(0, 3)) expect(clue.toLowerCase(), c.id).not.toContain(c.answer.toLowerCase());
    }
  });
});

describe("Image Rush scoring", () => {
  it("combo steps at 3, 6, 10", () => {
    expect([1, 2, 3, 5, 6, 9, 10, 20].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3, 3, 5, 5]);
  });
  it("XP is capped per game", () => {
    expect(xpFor("rush", 1_000_000)).toBe(GAME_XP_CAP.rush);
    expect(xpFor("probe", 500)).toBe(20);
  });
});

describe("Visual mnemonics", () => {
  it("at least 30 cards, and every letter of the list lights up in its phrase", () => {
    expect(MNEMONICS.length).toBeGreaterThanOrEqual(30);
    for (const m of MNEMONICS) {
      const lit = phraseParts(m).filter((p) => p.hit).map((p) => p.text.toLowerCase());
      expect(lit, m.id).toEqual(m.letters.map(([l]) => l.toLowerCase()));
    }
  });
});

describe("Flowcharts", () => {
  it("at least 25 charts, every arrow leads to a box, and every box can be reached", () => {
    expect(FLOWCHARTS.length).toBeGreaterThanOrEqual(25);
    for (const c of FLOWCHARTS) {
      const ids = new Set(c.nodes.map((n) => n.id));
      expect(ids.size, c.id).toBe(c.nodes.length);
      for (const n of c.nodes) {
        if (n.kind === "question") {
          expect(ids.has(n.yes!), `${c.id}/${n.id} yes`).toBe(true);
          expect(ids.has(n.no!), `${c.id}/${n.id} no`).toBe(true);
        }
        if (n.kind === "step") expect(ids.has(n.next!), `${c.id}/${n.id} next`).toBe(true);
      }
      const seen = new Set<string>();
      const walk = (id?: string) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        const n = c.nodes.find((x) => x.id === id)!;
        [n.yes, n.no, n.next].forEach(walk);
      };
      walk(c.nodes[0]!.id);
      expect([...ids].filter((id) => !seen.has(id)), `${c.id} unreachable`).toEqual([]);
      expect(flashcardsFrom(c).length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("Flowchart layout", () => {
  it("every box has a place, and no two boxes in a row overlap", () => {
    for (const c of FLOWCHARTS) {
      const l = layoutFlow(c.nodes);
      for (const n of c.nodes) {
        expect(l.col.get(n.id), `${c.id}/${n.id}`).toBeGreaterThanOrEqual(0);
        for (const m of c.nodes) {
          if (m !== n && l.rank.get(m.id) === l.rank.get(n.id)) expect(Math.abs(l.col.get(m.id)! - l.col.get(n.id)!), `${c.id} ${n.id}/${m.id}`).toBeGreaterThan(0.99);
        }
      }
      // Arrows going down always go to a lower row.
      for (const e of l.edges) if (!e.back) expect(l.rank.get(e.to)!, c.id).toBeGreaterThan(l.rank.get(e.from)!);
    }
  });
});

describe("Playlists", () => {
  it("ids look real and don't repeat within a subject", () => {
    for (const p of PLAYLISTS) {
      expect(p.lists.length, p.subject).toBeGreaterThan(1);
      expect(new Set(p.lists.map((l) => l.id)).size, p.subject).toBe(p.lists.length);
      for (const l of p.lists) expect(l.id, l.title).toMatch(/^PL[\w-]{16,}$/);
    }
  });
});

describe("Latest research", () => {
  it("every item has a link, a takeaway and a bedside point, and its filter exists", () => {
    for (const r of RESEARCH) {
      expect(r.url, r.id).toMatch(/^https:\/\//);
      expect(r.takeaway.length).toBeGreaterThan(30);
      expect(r.bedside.length).toBeGreaterThan(30);
      expect(r.exam.length, r.id).toBeGreaterThan(10);
    }
  });
});

describe("Avatar sex choice", () => {
  it("a persona can be saved as a man or a woman, and nothing else gets through", () => {
    expect(isPersona("er-resus")).toBe(true);
    expect(isPersona("er-resus~m")).toBe(true);
    expect(isPersona("interventional-cardiologist~f")).toBe(true);
    expect(isPersona("er-resus~x")).toBe(false);
    expect(isPersona("nobody~m")).toBe(false);
    expect(personaParts("radiology-ace~f")).toEqual({ id: "radiology-ace", sex: "f" });
    expect(parseAvatar({ persona: "bone-setter~f" })?.persona).toBe("bone-setter~f");
  });
});
