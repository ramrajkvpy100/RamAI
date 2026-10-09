import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { generateDebrief } from "@/engine/debrief";
import { confirmEmail, sendVerification } from "@/server/account";
import { claimGuest, createGuest, createSession, createUser, findUserById, markEmailVerified, userForToken } from "@/server/auth";
import { db, tx, useClientForTests } from "@/server/db";
import { ensureMembership, leagueView } from "@/server/leagues";
import { leaderboard, progressFor, recordCase } from "@/server/results";

import { play } from "./helpers";

/**
 * The same account, results and league code, through the libSQL client the app
 * uses for Turso — a local file stands in for the cloud database.
 */
const file = path.join(tmpdir(), `ramai-cloud-${process.pid}-${Date.now()}.db`);
process.env.RAMAI_OUTBOX_DIR = path.join(tmpdir(), `ramai-cloud-outbox-${process.pid}`);
delete process.env.RAMAI_EMAIL_PROVIDER;

beforeAll(async () => {
  await useClientForTests(createClient({ url: `file:${file}` }));
});
afterAll(() => {
  for (const f of [file, `${file}-wal`, `${file}-shm`, process.env.RAMAI_OUTBOX_DIR!]) rmSync(f, { recursive: true, force: true });
});

describe("the cloud database adapter", () => {
  it("returns plain rows that spread and destructure", async () => {
    await createUser({ email: "rows@example.com", username: "rows", name: "Dr. Rows", password: "stethoscope" });
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

  it("signs up, refuses duplicates, and keeps sessions", async () => {
    const user = await createUser({ email: "cloud@example.com", username: "cloud.doc", name: "Dr. Cloud", password: "stethoscope" });
    await expect(createUser({ email: "CLOUD@example.com", username: "other", name: "X", password: "stethoscope" })).rejects.toMatchObject({ code: "EXISTS" });
    const { token } = await createSession(user.id);
    expect((await userForToken(token))?.id).toBe(user.id);
  });

  it("verifies email and records cases into leaderboards and leagues", async () => {
    const user = await createUser({ email: "league@example.com", username: "league.doc", name: "Dr. League", password: "stethoscope" });
    expect((await sendVerification(user, "http://localhost:3218")).sent).toBe(true);
    const link = (await db.get<{ token_hash: string }>("SELECT token_hash FROM auth_tokens WHERE user_id = ?", user.id))!;
    expect(link.token_hash).toBeTruthy();
    await markEmailVerified(user.id);
    const verified = (await findUserById(user.id))!;

    const { hidden, state } = play(dermAcne, ["What brings you here?", "Examine the face", "Final diagnosis: acne vulgaris. Case close."]);
    const rewards = await recordCase(verified, "cloud-s1", generateDebrief(dermAcne, hidden, state));
    expect(rewards.streakDays).toBe(1);
    expect((await progressFor(user.id)).casesCompleted).toBe(1);
    expect((await leaderboard("overall", "week", user.id)).me?.userId).toBe(user.id);
    expect((await ensureMembership(verified))?.tier).toBe(0);
    expect((await leagueView(verified)).status).toBe("joined");
    expect(await confirmEmail("not-a-real-token")).toBeNull();
  });

  it("guests play first and keep their results when they sign up", async () => {
    const guest = await createGuest("UK");
    expect(guest.country).toBe("UK");
    await db.run(
      "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'cloud-g1', 'tut', 1, 'Emergency', 'emergency', 'chc', 'x', 'correct', 80, 100, ?)",
      guest.id, Date.now(),
    );
    const claimed = await claimGuest(guest.id, { email: "guest.cloud@example.com", username: "guest.cloud", name: "Dr. Guest", password: "stethoscope" });
    expect(claimed.isGuest).toBe(false);
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
    const { appUrl } = await import("@/server/account");
    const env = process.env as Record<string, string | undefined>;
    env.VERCEL_PROJECT_PRODUCTION_URL = "ram-ai-liard.vercel.app";
    try {
      expect(appUrl(new Request("https://evil.example.com/x", { headers: { host: "evil.example.com" } }))).toBe("https://ram-ai-liard.vercel.app");
    } finally {
      delete env.VERCEL_PROJECT_PRODUCTION_URL;
    }
  });
});
