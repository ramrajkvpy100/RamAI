/**
 * Web Push, with no third-party service in between.
 *
 * The VAPID key pair (RFC 8292) is derived from the server's own secret, so
 * there is nothing extra to configure. Every message is encrypted for the one
 * browser that asked for it (RFC 8291) — the push service only relays bytes.
 */
import "server-only";

import { createCipheriv, createECDH, createHmac, createPrivateKey, hkdfSync, randomBytes, sign, type KeyObject } from "node:crypto";

import { deriveSecret } from "@/engine/session";
import { SITE } from "@/lib/site";

export interface PushTarget {
  endpoint: string;
  /** The browser's P-256 public key, base64url. */
  p256dh: string;
  /** The browser's 16-byte auth secret, base64url. */
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/* -------------------------------------------------------------------------- */
/* Keys                                                                        */
/* -------------------------------------------------------------------------- */

// The order of the P-256 group: a private key must lie in [1, n − 1].
const P256_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const inRange = (d: Buffer) => {
  const v = BigInt(`0x${d.toString("hex")}`);
  return v > BigInt(0) && v < P256_N;
};

let cached: { seed: string; publicKey: Buffer; privateKey: KeyObject } | null = null;

/** The server's VAPID key pair. Changes only if the server secret does (browsers then subscribe again). */
export function vapidKeys(): { publicKey: Buffer; privateKey: KeyObject } {
  let d = deriveSecret("ramai/vapid/v1");
  const seed = d.toString("hex");
  if (cached?.seed === seed) return cached;
  for (let i = 0; !inRange(d); i++) d = createHmac("sha256", d).update(String(i)).digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(d);
  const publicKey = ecdh.getPublicKey();
  const privateKey = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: d.toString("base64url"), x: publicKey.subarray(1, 33).toString("base64url"), y: publicKey.subarray(33).toString("base64url") },
    format: "jwk",
  });
  cached = { seed, publicKey, privateKey };
  return cached;
}

/** What browsers subscribe with (`applicationServerKey`). */
export const vapidPublicKey = () => vapidKeys().publicKey.toString("base64url");

/** `Authorization` for one push service: a short-lived ES256 token naming who is sending. */
export function vapidAuthorization(endpoint: string, now = Date.now()): string {
  const { publicKey, privateKey } = vapidKeys();
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: `${SITE.url}/contact` })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${signature.toString("base64url")}, k=${publicKey.toString("base64url")}`;
}

/* -------------------------------------------------------------------------- */
/* Encryption — RFC 8291, aes128gcm                                            */
/* -------------------------------------------------------------------------- */

const RECORD_SIZE = 4096;

/** `fixed` pins the sender's key and salt — only for checking against the RFC's worked example. */
export function encryptPayload(plaintext: Buffer, uaPublic: Buffer, authSecret: Buffer, fixed?: { senderPrivate: Buffer; salt: Buffer }): Buffer {
  const ecdh = createECDH("prime256v1");
  if (fixed) ecdh.setPrivateKey(fixed.senderPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = fixed?.salt ?? randomBytes(16);
  const hkdf = (ikm: Buffer, salt: Buffer, info: string | Buffer, length: number) => Buffer.from(hkdfSync("sha256", ikm, salt, info, length));

  const ikm = hkdf(ecdh.computeSecret(uaPublic), authSecret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const cek = hkdf(ikm, salt, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdf(ikm, salt, "Content-Encoding: nonce\0", 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // One record: the message, then the 0x02 delimiter that marks the last record.
  const sealed = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Push services RamAI will deliver to. A subscription names a URL the server
 * then POSTs to, so anything else (an internal address, say) is refused.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".notify.windows.com", ".push.apple.com"];

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  return PUSH_HOSTS.includes(url.hostname) || PUSH_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s));
}

/** `gone`: the browser unsubscribed or the subscription expired — forget it. */
export type PushOutcome = "sent" | "gone" | "failed";

export async function sendPush(target: PushTarget, message: PushMessage, ttlSeconds: number): Promise<PushOutcome> {
  if (!isPushEndpoint(target.endpoint)) return "gone";
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), Buffer.from(target.p256dh, "base64url"), Buffer.from(target.auth, "base64url"));
  try {
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(target.endpoint),
        TTL: String(Math.max(0, Math.floor(ttlSeconds))),
        Urgency: "normal",
        // A newer reminder replaces one the device hasn't collected yet.
        Topic: "daily-reminder",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(body),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "sent";
    if (res.status === 404 || res.status === 410) return "gone";
    console.warn(`[ramai] push to ${new URL(target.endpoint).hostname} failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return "failed";
  } catch (err) {
    console.warn("[ramai] push failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
}
