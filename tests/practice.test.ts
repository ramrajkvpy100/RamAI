import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createProfile, type User } from "@/server/auth";
import { addPicture, missingPictures, picture, practiceStats, recordRound, round } from "@/server/practice";
import { MODALITIES } from "@/lib/practice";

process.env.RAMAI_DB_PATH = ":memory:";

/** Wikimedia Commons and the AI checker, stood in for: one real image per search, judged by `verdict`. */
function stub(verdict: { realistic: number; matches: number }) {
  const calls: string[] = [];
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.startsWith("https://commons.wikimedia.org/w/api.php")) {
        calls.push("search");
        n += 1;
        const page = { index: 1, title: `File:Pneumothorax ${n}.jpg`, imageinfo: [{ thumburl: `https://upload.wikimedia.org/t${n}.jpg`, url: `https://upload.wikimedia.org/f${n}.jpg`, mime: "image/jpeg", width: 1200, height: 1100, descriptionurl: `https://commons.wikimedia.org/wiki/File:P${n}.jpg`, extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "Dr Radiologist" } } }] };
        return Response.json({ query: { pages: { "1": page } } });
      }
      if (u.startsWith("https://upload.wikimedia.org/")) return new Response(Buffer.from(`real ${u}`));
      if (u.endsWith("/chat/completions")) {
        calls.push("check");
        return Response.json({ choices: [{ message: { content: JSON.stringify({ ...verdict, labels: false, problems: "", search: "" }) } }] });
      }
      if (u.endsWith("/images/generations")) {
        calls.push("draw");
        return Response.json({ data: [{ b64_json: Buffer.from("ai picture").toString("base64") }] });
      }
      throw new Error(`unexpected ${u}`);
    }),
  );
  return calls;
}

let anil: User;
beforeAll(async () => {
  anil = await createProfile({ email: "anil@example.com", username: "anil", name: "Anil M" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
});

describe("practice drills", () => {
  it("ECGs RamAI can draw are ready at once, each with four names and the right one among them", async () => {
    const { items, ready } = await round("ecg", "spot");
    expect(items.length).toBe(10);
    expect(ready).toBe(MODALITIES.ecg.items.filter((i) => i.ecg).length);
    for (const it of items) {
      expect(it.source).toBe("drawn");
      expect(it.ecg?.kind).toBe("ecg");
      expect(it.options).toHaveLength(4);
      expect(new Set(it.options).size).toBe(4);
      expect(it.options[it.answer]).toBe(MODALITIES.ecg.items.find((x) => x.id === it.item)!.label);
    }
  });

  it("a real image is kept only when the checker agrees it shows the diagnosis — then served, credited, to every round", async () => {
    process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);
    stub({ realistic: 2, matches: 2 });
    expect(await addPicture("xray", "pneumothorax")).toBe(false);
    expect((await round("xray", "spot")).items).toHaveLength(0);

    vi.unstubAllGlobals();
    const calls = stub({ realistic: 9, matches: 9 });
    expect(await addPicture("xray", "pneumothorax")).toBe(true);
    expect(calls).toEqual(["search", "check"]);
    // A second picture of the same diagnosis is a different file.
    expect(await addPicture("xray", "pneumothorax")).toBe(true);
    const { items } = await round("xray", "spot");
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.credit?.source)).size).toBe(2);
    expect(items[0]).toMatchObject({ item: "pneumothorax", source: "commons", credit: { license: "CC BY 4.0", author: "Dr Radiologist" } });
    const id = items[0]!.image!.split("/").pop()!;
    expect((await picture(id))?.data.toString()).toMatch(/^real https:\/\/upload\.wikimedia\.org\//);
    expect(await missingPictures("xray", 50)).not.toContain(undefined);
  });

  it("keeps each round on the doctor's own record — apart from XP and rank", async () => {
    await recordRound(anil.id, { modality: "ecg", mode: "rapid", correct: 14, total: 17 });
    await recordRound(anil.id, { modality: "ecg", mode: "spot", correct: 8, total: 10 });
    expect(await practiceStats(anil.id)).toEqual([{ modality: "ecg", rounds: 2, correct: 22, total: 27, best: 14 }]);
  });
});
