/**
 * Invents a patient and has the image model draw one of its pictures — skipped unless asked for:
 *   RAMAI_LIVE_OPENAI=1 npx vitest run tests/openai-image-live.test.ts
 * Costs about 5 cents. Saves the picture to RAMAI_IMAGE_OUT for a look.
 */
import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe.skipIf(process.env.RAMAI_LIVE_OPENAI !== "1")("OpenAI live — a picture", () => {
  it("draws the picture an invented case describes", async () => {
    process.loadEnvFile(".env.local");
    process.env.RAMAI_AI_CASES = "1";
    const { createOpenAIProvider } = await import("@/engine/providers/openai");
    const { drawPicture } = await import("@/server/ai-images");
    let src;
    for (let i = 0; i < 2; i++) {
      src = await createOpenAIProvider().createCase({ country: "IN", specialty: (process.env.RAMAI_IMAGE_SPECIALTY as "Dermatology") ?? "Dermatology", track: "opd", level: "district", allowedLevels: ["district"] });
      if (src.kind === "generated" && Object.keys(src.def.pictures ?? {}).length) break;
    }
    if (src?.kind !== "generated") throw new Error("no case");
    const [ref, picture] = Object.entries(src.def.pictures ?? {})[0] ?? [];
    expect(picture).toBeDefined();
    console.log(`Case: ${src.def.truth.diagnosis} — picture ${ref}: ${picture!.type}, ${picture!.view}\n  describe: ${picture!.describe}`);
    const t = Date.now();
    const drawn = await drawPicture(picture!);
    console.log(`Drawn in ${Date.now() - t} ms, ${Math.round((drawn.base64.length * 3) / 4 / 1024)} KB ${drawn.mime}`);
    if (process.env.RAMAI_IMAGE_OUT) writeFileSync(process.env.RAMAI_IMAGE_OUT, Buffer.from(drawn.base64, "base64"));
  }, 180_000);
});
