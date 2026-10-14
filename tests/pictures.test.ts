import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { dermMelasma } from "@/engine/cases/derm-melasma";
import { surgAppendicitis } from "@/engine/cases/surg-appendicitis";
import { createHiddenState, imagingPicture, openingEffects, openingPicture } from "@/engine/simulator";
import { libraryPicture, makePicture } from "@/server/ai-images";
import { db } from "@/server/db";

import { play } from "./helpers";

describe("every scan is a picture to read — its report waits", () => {
  it("a USG is drawn from its own report, which is read out only when asked for", () => {
    const { state, hidden } = play(surgAppendicitis, ["Order USG abdomen"]);
    const usg = state.investigations[0]!;
    expect(usg.media?.ai).toMatchObject({ ref: "i-inv-1", type: "usg" });
    expect(usg.report).toBeTruthy();
    const brief = imagingPicture(surgAppendicitis, hidden.investigations[0]!)!;
    expect(brief.type).toBe("usg");
    expect(brief.describe).toContain(usg.report!.slice(0, 40));
    expect(state.messages.some((m) => m.text.includes(usg.report!))).toBe(false);

    const asked = play(surgAppendicitis, ["Order USG abdomen", "What does the USG report say?"]);
    expect(asked.state.messages.at(-1)?.text).toBe(`USG abdomen report — ${usg.report}`);
  });

  it("lab results stay as they were — no picture", () => {
    const { state } = play(surgAppendicitis, ["Order CBC"]);
    expect(state.investigations[0]?.media).toBeUndefined();
  });
});

type Review = { realistic: number; matches: number; labels?: boolean };

/** OpenAI's image and chat endpoints and Wikimedia Commons, stood in for. */
function stub(opts: { reviews: Review[]; commons?: boolean; reviewDown?: boolean; drawDown?: boolean }) {
  const reviews = [...opts.reviews];
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/images/generations")) {
        calls.push("draw");
        if (opts.drawDown) return Response.json({ error: { code: "server_error" } }, { status: 500 });
        return Response.json({ data: [{ b64_json: Buffer.from(`drawn-${calls.filter((c) => c === "draw").length}`).toString("base64") }] });
      }
      if (u.endsWith("/chat/completions")) {
        calls.push("review");
        if (opts.reviewDown) return Response.json({ error: { code: "server_error" } }, { status: 500 });
        const r = reviews.shift() ?? { realistic: 3, matches: 3 };
        return Response.json({ choices: [{ message: { content: JSON.stringify({ ...r, labels: r.labels ?? false, problems: "looks drawn", search: "chest radiograph consolidation" }) } }] });
      }
      if (u.startsWith("https://commons.wikimedia.org/w/api.php")) {
        calls.push("search");
        const page = {
          index: 1,
          title: "File:Chest radiograph right lower zone.jpg",
          imageinfo: [{ thumburl: "https://upload.wikimedia.org/thumb.jpg", url: "https://upload.wikimedia.org/full.jpg", mime: "image/jpeg", width: 1200, height: 1100, descriptionurl: "https://commons.wikimedia.org/wiki/File:Chest.jpg", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "<a href='https://example.org'>Dr Example</a>" } } }],
        };
        const labelled = { ...page, index: 0, title: "File:Chest radiograph with arrows.jpg" };
        return Response.json({ query: { pages: opts.commons ? { "1": page, "2": labelled } : {} } });
      }
      if (u.startsWith("https://upload.wikimedia.org/")) {
        calls.push(`fetch ${u.split("/").pop()}`);
        return new Response(Buffer.from("real-image"));
      }
      throw new Error(`unexpected ${u}`);
    }),
  );
  return calls;
}

const BRIEF = { type: "xray" as const, view: "PA erect", describe: "Chest X-ray PA of a 68-year-old female: right lower zone consolidation with air bronchograms.", topic: "Community-acquired pneumonia" };
const text = (base64: string) => Buffer.from(base64, "base64").toString();

describe("pictures are checked before the doctor sees them", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("a real, freely licensed image comes first — credited, never one with arrows — and nothing is drawn", async () => {
    const calls = stub({ reviews: [{ realistic: 9, matches: 8 }], commons: true });
    const pic = await makePicture(BRIEF);
    expect(text(pic.base64)).toBe("real-image");
    expect(pic.credit).toEqual({ author: "Dr Example", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Chest.jpg" });
    expect(calls).toEqual(["search", "fetch thumb.jpg", "review"]);
  });

  it("with no real image to be had, the image model draws one, checked before it's shown", async () => {
    const calls = stub({ reviews: [{ realistic: 8, matches: 8 }] });
    const pic = await makePicture(BRIEF);
    expect(text(pic.base64)).toBe("drawn-1");
    expect(pic.credit).toBeUndefined();
    expect(calls.filter((c) => c === "search").length).toBeGreaterThan(0);
    expect(calls.slice(-2)).toEqual(["draw", "review"]);
  });

  it("a drawing that fails the check is drawn once more — and the better one is kept", async () => {
    const calls = stub({ reviews: [{ realistic: 4, matches: 4 }, { realistic: 7, matches: 7 }] });
    const pic = await makePicture(BRIEF);
    expect(text(pic.base64)).toBe("drawn-2");
    expect(calls.slice(-4)).toEqual(["draw", "review", "draw", "review"]);
  });

  it("if the check itself is down, the drawing is shown rather than nothing", async () => {
    stub({ reviews: [], reviewDown: true });
    expect(text((await makePicture(BRIEF)).base64)).toBe("drawn-1");
  });
  it("the same picture, word for word, is found once and shared by every case after", async () => {
    process.env.RAMAI_DB_PATH = ":memory:";
    await db.run("DELETE FROM picture_library");
    const first = stub({ reviews: [{ realistic: 9, matches: 8 }], commons: true });
    expect(text((await libraryPicture(BRIEF)).base64)).toBe("real-image");
    expect(first.length).toBeGreaterThan(0);
    const second = stub({ reviews: [] });
    const again = await libraryPicture(BRIEF);
    expect(text(again.base64)).toBe("real-image");
    expect(again.credit?.license).toBe("CC BY-SA 4.0");
    expect(second).toEqual([]);
    // A different finding is never served from it.
    stub({ reviews: [{ realistic: 8, matches: 8 }] });
    expect(text((await libraryPicture({ ...BRIEF, describe: "Chest X-ray PA: left pneumothorax." })).base64)).toBe("drawn-1");
  });

  it("a picture that failed its check is never kept for others", async () => {
    process.env.RAMAI_DB_PATH = ":memory:";
    await db.run("DELETE FROM picture_library");
    const brief = { ...BRIEF, view: "AP supine" };
    stub({ reviews: [{ realistic: 3, matches: 3 }, { realistic: 3, matches: 3 }] });
    await libraryPicture(brief);
    expect(await db.get("SELECT COUNT(*) AS n FROM picture_library")).toMatchObject({ n: 0 });
  });
});

describe("opening photographs", () => {
  it("are real or AI photographs, not drawings — the drawing stays only as an offline stand-in", () => {
    for (const def of [dermMelasma, dermAcne]) {
      const photo = openingEffects(def, createHiddenState(def)).find((e) => e.type === "message" && e.media);
      const media = photo?.type === "message" ? photo.media : undefined;
      expect(media?.ai).toMatchObject({ ref: "o-0", type: "photo" });
      expect(media?.spec?.kind).toBe("derm");
      const picture = openingPicture(def, "o-0");
      expect(picture?.describe).toContain(def.truth.diagnosis);
      expect(picture?.describe).toContain(`${def.patient.age}-year-old`);
    }
    expect(openingPicture(dermMelasma, "o-9")).toBeNull();
  });
});
