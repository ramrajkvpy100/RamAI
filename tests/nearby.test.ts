import { db } from "@/server/db";
import { beforeAll, describe, expect, it } from "vitest";

import { createProfile, findUserById, setProfileDetails, type User } from "@/server/auth";
import { createDuel } from "@/server/duels";
import { answerRequest, nearbyDoctors, pendingRequests, requestDuel } from "@/server/nearby";

process.env.RAMAI_DB_PATH = ":memory:";

let asha: User;
let ravi: User;
let meera: User;

beforeAll(async () => {
  asha = await createProfile({ email: "asha.n@example.com", username: "ashan", name: "Asha" });
  ravi = await createProfile({ email: "ravi.n@example.com", username: "ravin", name: "Ravi" });
  meera = await createProfile({ email: "meera.n@example.com", username: "meeran", name: "Meera" });
  await setProfileDetails(asha.id, { city: "Jaipur" });
  await setProfileDetails(ravi.id, { city: " jaipur " });
  await setProfileDetails(meera.id, { city: "Kochi" });
  asha = (await findUserById(asha.id))!;
  ravi = (await findUserById(ravi.id))!;
});

describe("near me: play doctors around you", () => {
  it("finds doctors in the same city, never yourself or doctors elsewhere", async () => {
    const { doctors, place } = await nearbyDoctors(asha);
    expect(place).toBe("Jaipur");
    expect(doctors.map((d) => d.name)).toEqual(["Ravi"]);
  });

  it("asks only nearby doctors, once each, and they can accept", async () => {
    await createDuel("dddddddddddd", "invite", { id: asha.id, name: "Asha" }, { kind: "library", id: "med-pad" });
    expect(await requestDuel(asha, "dddddddddddd", [ravi.id, meera.id, ravi.id])).toBe(1);
    expect(await requestDuel(asha, "dddddddddddd", [ravi.id])).toBe(0);
    // Someone else's duel can't be used to send requests.
    expect(await requestDuel(ravi, "dddddddddddd", [asha.id])).toBe(0);
    const [req] = await pendingRequests(ravi.id);
    expect(req).toMatchObject({ duelId: "dddddddddddd", from: "Asha" });
    expect(await answerRequest(meera.id, req!.id, true)).toBeNull();
    expect(await answerRequest(ravi.id, req!.id, true)).toBe("dddddddddddd");
    expect(await pendingRequests(ravi.id)).toEqual([]);
  });

  it("without a city or location, asks for one", async () => {
    const neha = await createProfile({ email: "neha.n@example.com", username: "nehan", name: "Neha" });
    expect((await nearbyDoctors(neha)).needs).toBe("location");
    void db;
  });
});
