import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { generateDebrief } from "@/engine/debrief";
import { createGuest, createProfile, createSession, findUserById, guestForToken, linkProfile } from "@/server/auth";
import { db, tx, useClientForTests } from "@/server/db";
import { ensureMembership, leagueView } from "@/server/leagues";
import { leaderboard, progressFor, recordCase } from "@/server/results";

import { play } from "./helpers";

/**
 * The same account, results and league code, through the libSQL client the app
 * uses for Turso — a local file stands in for the cloud database.
 */
const file = path.join(tmpdir(), `ramai-cloud-${process.pid}-${Date.now()}.db`);

beforeAll(async () => {
  await useClientForTests(createClient({ url: `file:${file}` }));
});
afterAll(() => {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { recursive: true, force: true });
});

describe("the cloud database adapter", () => {
  it("returns plain rows that spread and destructure", async () => {
    await createProfile({ email: "rows@example.com", username: "rows", name: "Dr. Rows" });
    const [row] = await db.all<{ username: string; name: string }>("SELECT username, name FROM users WHERE username = ?", "rows");
    const { username, ...rest } = row!;
    expect(username).toBe("rows");
    expect(rest).toEqual({ name: "Dr. Rows" });
  });

  it("rolls a failed transaction back", async () => {
    await expect(
      tx(async (t) => {
        await t.run("UPDATE users SET name = 'Changed' WHERE username = ?", "rows");
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect((await db.get<{ name: string }>("SELECT name FROM users WHERE username = ?", "rows"))?.name).toBe("Dr. Rows");
  });

  it("makes profiles, refuses duplicates, and keeps guests' sessions", async () => {
    await createProfile({ email: "cloud@example.com", username: "cloud.doc", name: "Dr. Cloud" });
    await expect(createProfile({ email: "CLOUD@example.com", username: "other", name: "X" })).rejects.toMatchObject({ code: "EXISTS" });
    const guest = await createGuest();
    const { token } = await createSession(guest.id);
    expect((await guestForToken(token))?.id).toBe(guest.id);
  });

  it("records cases into leaderboards and leagues", async () => {
    const verified = await createProfile({ email: "league@example.com", username: "league.doc", name: "Dr. League" });
    const { hidden, state } = play(dermAcne, ["What brings you here?", "Examine the face", "Final diagnosis: acne vulgaris. Case close."]);
    const rewards = await recordCase(verified, "cloud-s1", generateDebrief(dermAcne, hidden, state));
    expect(rewards.streakDays).toBe(1);
    expect((await progressFor(verified.id)).casesCompleted).toBe(1);
    expect((await leaderboard("overall", "week", verified.id)).me?.userId).toBe(verified.id);
    expect((await ensureMembership(verified))?.tier).toBe(0);
    expect((await leagueView(verified)).status).toBe("joined");
  });

  it("guests play first and keep their results when they sign up", async () => {
    const guest = await createGuest("UK");
    expect(guest.country).toBe("UK");
    await db.run(
      "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'cloud-g1', 'tut', 1, 'Emergency', 'emergency', 'chc', 'x', 'correct', 80, 100, ?)",
      guest.id, Date.now(),
    );
    const claimed = await linkProfile(
      { id: "5d1f6a9e-0000-4000-8000-00000000c10d", email: "guest.cloud@example.com", confirmed: true, meta: { name: "Dr. Guest", username: "guest.cloud" } },
      { guestId: guest.id },
    );
    expect(claimed?.id).toBe(guest.id);
    expect(claimed?.isGuest).toBe(false);
    expect((await findUserById(guest.id))?.username).toBe("guest.cloud");
    expect((await progressFor(guest.id)).casesCompleted).toBe(1);
  });
});

describe("hosting without extra settings", () => {
  it("finds the Turso database under the integration's names, or a custom prefix", async () => {
    const { remoteDatabase } = await import("@/lib/server/database-env");
    expect(remoteDatabase({ TURSO_DATABASE_URL: "libsql://a.turso.io", TURSO_AUTH_TOKEN: "t1" })).toEqual({ url: "libsql://a.turso.io", authToken: "t1" });
    expect(remoteDatabase({ STORE_DATABASE_URL: "libsql://b.turso.io", STORE_AUTH_TOKEN: "t2" })).toEqual({ url: "libsql://b.turso.io", authToken: "t2" });
    expect(remoteDatabase({ DATABASE_URL: "postgres://x", PATH: "/bin" })).toBeNull();
  });

  it("seals case sessions in production with only the database token", async () => {
    const { seal, unseal } = await import("@/engine/session");
    const env = process.env as Record<string, string | undefined>;
    const saved = { node: env.NODE_ENV, secret: env.RAMAI_SESSION_SECRET, url: env.TURSO_DATABASE_URL, token: env.TURSO_AUTH_TOKEN };
    env.NODE_ENV = "production";
    delete env.RAMAI_SESSION_SECRET;
    env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    env.TURSO_AUTH_TOKEN = "x".repeat(40) + ".signature-part-of-a-long-turso-token";
    try {
      const token = seal({ v: 1, sid: "s", u: "u", n: 1, src: { kind: "library", id: "x" }, a: [], t: 1 });
      expect(unseal(token).sid).toBe("s");
    } finally {
      for (const [k, v] of Object.entries({ NODE_ENV: saved.node, RAMAI_SESSION_SECRET: saved.secret, TURSO_DATABASE_URL: saved.url, TURSO_AUTH_TOKEN: saved.token })) {
        if (v === undefined) delete env[k];
        else env[k] = v;
      }
    }
  });

  it("links emails to Vercel's production address when no app URL is set", async () => {
    const { appUrl } = await import("@/server/app-url");
    const env = process.env as Record<string, string | undefined>;
    env.VERCEL_PROJECT_PRODUCTION_URL = "ram-ai-liard.vercel.app";
    try {
      expect(appUrl(new Request("https://evil.example.com/x", { headers: { host: "evil.example.com" } }))).toBe("https://ram-ai-liard.vercel.app");
    } finally {
      delete env.VERCEL_PROJECT_PRODUCTION_URL;
    }
  });
});
