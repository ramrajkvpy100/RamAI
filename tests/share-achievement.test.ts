import { describe, expect, it } from "vitest";

import { createProfile } from "@/server/auth";
import { achievementCard, achievementValue, readShareId, shareIdFor } from "@/server/share";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_SESSION_SECRET = "test-secret-test-secret-test-secret-123";

describe("achievement cards", () => {
  it("show only what the doctor really holds — and their link can't be forged", async () => {
    const u = await createProfile({ email: "meera@example.com", username: "meera.k", name: "Meera Kapoor" });
    // A badge not yet earned has no card.
    expect(await achievementCard(achievementValue(u.id, "sharp-eye"))).toBeNull();
    // Their rank always does, from their own record.
    const rank = await achievementCard(achievementValue(u.id));
    expect(rank).toMatchObject({ kind: "achievement", name: "Dr. Meera", prize: { kind: "rank" } });
    const id = shareIdFor("a", achievementValue(u.id));
    expect(readShareId(id)).toEqual({ kind: "a", value: achievementValue(u.id) });
    expect(readShareId(`${id.slice(0, -1)}${id.endsWith("x") ? "y" : "x"}`)).toBeNull();
    expect(readShareId(shareIdFor("a", achievementValue(u.id)).replace(u.id, "someone-else"))).toBeNull();
  });
});
