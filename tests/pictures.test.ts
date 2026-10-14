import { describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { dermMelasma } from "@/engine/cases/derm-melasma";
import { createHiddenState, openingEffects, openingPicture } from "@/engine/simulator";

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
