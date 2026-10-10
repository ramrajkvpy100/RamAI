import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGuest, createUser } from "@/server/auth";
import { db } from "@/server/db";
import { deleteAccount } from "@/server/privacy";
import { encryptPayload, isPushEndpoint, vapidAuthorization, vapidPublicKey, type PushTarget } from "@/server/push";
import { reminderFor, removeSubscription, saveSubscription, sendDailyReminders, subscriptionProblem } from "@/server/reminders";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_SESSION_SECRET = "test-secret-test-secret-test-secret-123";

const b = (s: string) => Buffer.from(s, "base64url");

/** A browser's side of a subscription. */
function browser(endpoint = `https://fcm.googleapis.com/fcm/send/${randomBytes(12).toString("base64url")}`) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const target: PushTarget = { endpoint, p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
  return { ecdh, auth, target };
}

/** Decrypts as a browser would (RFC 8291), written separately from the sender. */
function decrypt(body: Buffer, ecdh: ReturnType<typeof createECDH>, auth: Buffer): string {
  const salt = body.subarray(0, 16);
  const idlen = body[20]!;
  const asPublic = body.subarray(21, 21 + idlen);
  const sealed = body.subarray(21 + idlen);
  const uaPublic = ecdh.getPublicKey();
  const ikm = Buffer.from(hkdfSync("sha256", ecdh.computeSecret(asPublic), auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const padded = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  expect(padded[padded.length - 1]).toBe(2);
  return padded.subarray(0, padded.length - 1).toString();
}

describe("message encryption (RFC 8291)", () => {
  it("matches the RFC's worked example byte for byte", () => {
    const asPrivate = b("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
    const ua = createECDH("prime256v1");
    ua.setPrivateKey(b("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"));
    expect(ua.getPublicKey().toString("base64url")).toBe("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
    const body = encryptPayload(Buffer.from("When I grow up, I want to be a watermelon"), ua.getPublicKey(), b("BTBZMqHH6r4Tts7J_aSIgg"), { senderPrivate: asPrivate, salt: b("DGv6ra1nlYgDCS1FRnbzlw") });
    expect(body.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("can only be read by the browser it was sent to", () => {
    const one = browser();
    const other = browser();
    const body = encryptPayload(Buffer.from('{"title":"🔥 hi"}'), one.ecdh.getPublicKey(), one.auth);
    expect(decrypt(body, one.ecdh, one.auth)).toBe('{"title":"🔥 hi"}');
    expect(() => decrypt(body, other.ecdh, other.auth)).toThrow();
    // A fresh key and salt every time.
    expect(encryptPayload(Buffer.from("x"), one.ecdh.getPublicKey(), one.auth).equals(encryptPayload(Buffer.from("x"), one.ecdh.getPublicKey(), one.auth))).toBe(false);
  });
});

describe("VAPID", () => {
  it("signs a short-lived token for the push service with a stable key", () => {
    const now = Date.now();
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", now);
    const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
    expect(key).toBe(vapidPublicKey());
    expect(vapidPublicKey()).toBe(vapidPublicKey());
    const pub = b(key!);
    expect(pub).toHaveLength(65);

    const [h, c, sig] = token!.split(".");
    expect(JSON.parse(b(h!).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(b(c!).toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp * 1000 - now).toBeGreaterThan(0);
    expect(claims.exp * 1000 - now).toBeLessThanOrEqual(24 * 3_600_000);
    expect(claims.sub).toMatch(/^https:\/\//);

    const publicKey = createPublicKey({ key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b(sig!))).toBe(true);
    expect(verify("sha256", Buffer.from(`${h}.${c}x`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b(sig!))).toBe(false);
  });
});

describe("subscriptions", () => {
  it("only accepts real push services — the server must never be pointed at anything else", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/fcm.googleapis.com",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://evilpush.apple.com/x",
      "not a url",
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });

  it("rejects keys a message could never be encrypted to", () => {
    expect(subscriptionProblem(browser().target)).toBeNull();
    const t = browser().target;
    expect(subscriptionProblem({ ...t, auth: randomBytes(8).toString("base64url") })).toMatch(/invalid/i);
    expect(subscriptionProblem({ ...t, p256dh: randomBytes(65).toString("base64url") })).toMatch(/invalid/i);
    const offCurve = Buffer.concat([Buffer.from([4]), randomBytes(64)]);
    expect(subscriptionProblem({ ...t, p256dh: offCurve.toString("base64url") })).toMatch(/invalid/i);
    expect(subscriptionProblem({ ...t, endpoint: "https://10.0.0.1/push" })).toMatch(/isn't supported/);
  });

  it("belongs to whoever subscribed last, keeps ten browsers, and goes with the account", async () => {
    const ann = await createUser({ email: "ann.push@example.com", username: "ann.push", name: "Dr. Ann", password: "quiet harbour 77" });
    const raj = await createUser({ email: "raj.push@example.com", username: "raj.push", name: "Dr. Raj", password: "quiet harbour 77" });
    const shared = browser().target;
    await saveSubscription(ann.id, shared, 1);
    await saveSubscription(raj.id, shared, 2);
    expect(await db.get("SELECT user_id FROM push_subscriptions WHERE endpoint = ?", shared.endpoint)).toEqual({ user_id: raj.id });

    await removeSubscription(ann.id, shared.endpoint);
    expect(await db.get("SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?", shared.endpoint)).toBeTruthy();
    await removeSubscription(raj.id, shared.endpoint);
    expect(await db.get("SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?", shared.endpoint)).toBeUndefined();

    const first = browser().target;
    await saveSubscription(ann.id, first, 10);
    for (let i = 0; i < 10; i++) await saveSubscription(ann.id, browser().target, 11 + i);
    const kept = await db.all<{ endpoint: string }>("SELECT endpoint FROM push_subscriptions WHERE user_id = ?", ann.id);
    expect(kept).toHaveLength(10);
    expect(kept.map((k) => k.endpoint)).not.toContain(first.endpoint);

    await deleteAccount(ann.id);
    expect(await db.all("SELECT 1 FROM push_subscriptions WHERE user_id = ?", ann.id)).toHaveLength(0);
  });
});

describe("the evening reminder", () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    return Date.parse(iso);
  };
  const played = (userId: string, when: number, n: number) =>
    db.run("INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, rescued, score, xp, created_at) VALUES (?, ?, 'c', 1, 'Medicine', 'opd', 'primary', 'x', 0, 70, 60, ?)", userId, `s-${userId}-${n}`, when);

  it("puts a streak about to break first, and never mentions the case", () => {
    const now = Date.parse("2026-10-20T13:30:00Z");
    expect(reminderFor(6, "2026-10-20", now)).toMatchObject({ title: "🔥 Your 6-day streak ends in 5 hours", url: "/" });
    expect(reminderFor(0, "2026-10-20", now).title).toBe("🩺 Daily case #11 is waiting");
    expect(reminderFor(1, "2026-10-20", Date.parse("2026-10-20T17:50:00Z")).title).toBe("🔥 Your 1-day streak ends in 1 hour");
  });

  it("reaches only players who haven't played today, once a day, in the evening", async () => {
    await db.run("DELETE FROM push_subscriptions");
    const keen = await createUser({ email: "keen@example.com", username: "keen.doc", name: "Dr. Keen", password: "quiet harbour 77" });
    const lapsed = await createUser({ email: "lapsed@example.com", username: "lapsed.doc", name: "Dr. Lapsed", password: "quiet harbour 77" });
    const streaky = await createUser({ email: "streaky@example.com", username: "streaky.doc", name: "Dr. Streaky", password: "quiet harbour 77" });
    const guest = await createGuest();
    const devices = Object.fromEntries([keen, lapsed, streaky, guest].map((u) => [u.id, browser().target]));
    for (const [id, t] of Object.entries(devices)) await saveSubscription(id, t);

    const evening = at("2026-10-20T13:30:00Z"); // 7 pm IST
    await played(keen.id, evening - 3_600_000, 1); // earlier today
    await played(streaky.id, evening - 86_400_000, 2); // yesterday
    await played(streaky.id, evening - 2 * 86_400_000, 3);

    const sent: { userId: string; title: string; ttl: number }[] = [];
    const send = async (t: PushTarget, m: { title: string }, ttl: number) => {
      sent.push({ userId: Object.keys(devices).find((id) => devices[id]!.endpoint === t.endpoint)!, title: m.title, ttl });
      return "sent" as const;
    };

    expect(await sendDailyReminders({ now: Date.parse("2026-10-20T04:30:00Z"), send })).toMatchObject({ skipped: expect.stringMatching(/5 pm and 11 pm/), due: 0 });
    expect(sent).toHaveLength(0);

    const run = await sendDailyReminders({ now: evening, send });
    expect(run).toMatchObject({ day: "2026-10-20", due: 3, played: 1, sent: 2 });
    expect(sent.map((s) => [s.userId, s.title]).sort()).toEqual(
      [
        [lapsed.id, "🩺 Daily case #11 is waiting"],
        [streaky.id, "🔥 Your 2-day streak ends in 5 hours"],
      ].sort(),
    );
    expect(sent[0]!.ttl).toBe(5 * 3600);

    // Running again (or a stray call) the same evening sends nothing.
    expect(await sendDailyReminders({ now: evening + 600_000, send })).toMatchObject({ due: 0, sent: 0 });
    expect(sent).toHaveLength(2);
  });

  it("forgets browsers that unsubscribed, and ones that keep failing", async () => {
    await db.run("DELETE FROM push_subscriptions");
    const doc = await createUser({ email: "flaky@example.com", username: "flaky.doc", name: "Dr. Flaky", password: "quiet harbour 77" });
    const gone = browser().target;
    const flaky = browser().target;
    await saveSubscription(doc.id, gone);
    await saveSubscription(doc.id, flaky);
    const send = async (t: PushTarget) => (t.endpoint === gone.endpoint ? ("gone" as const) : ("failed" as const));

    for (let day = 0; day < 5; day++) {
      const now = at(`2026-10-${21 + day}T13:30:00Z`);
      const run = await sendDailyReminders({ now, send });
      expect(run.failed).toBe(1);
      expect(await db.get("SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?", gone.endpoint)).toBeUndefined();
    }
    expect(await db.get("SELECT 1 AS x FROM push_subscriptions WHERE endpoint = ?", flaky.endpoint)).toBeUndefined();
  });
});
