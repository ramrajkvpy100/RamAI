import { readFileSync } from "node:fs";
import { it } from "vitest";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, ""); }
process.env.RAMAI_DB_PATH = ":memory:";
it("pic", { timeout: 120_000 }, async () => {
  const { drawPicture, makePicture } = await import("@/server/ai-images");
  const p = { type: "photo" as const, view: "Skin of the trunk and arms", describe: "Multiple raised, blanching, itchy wheals of varying size over the trunk and arms.", topic: "Acute urticaria" };
  let t = Date.now();
  try { const d = await drawPicture(p); console.log("draw ok", d.mime, d.base64.length, Date.now() - t, "ms"); } catch (e) { console.log("draw FAILED", (e as Error).message, Date.now() - t, "ms"); }
  t = Date.now();
  try { const m = await makePicture(p); console.log("make ok", m.checked, !!m.credit, Date.now() - t, "ms"); } catch (e) { console.log("make FAILED", (e as Error).message, Date.now() - t, "ms"); }
});
