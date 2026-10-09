/**
 * Sealed sessions.
 *
 * The client holds an opaque token; the server holds no state. A token is the
 * case reference plus the intent-resolved action log, compressed and sealed
 * with AES-256-GCM. The browser can neither read the hidden case nor forge
 * the log. Rotate RAMAI_SESSION_SECRET to invalidate all sessions.
 */
import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import { remoteDatabase } from "@/lib/server/database-env";

import type { Country } from "./countries";
import type { CaseSource } from "./providers/types";
import type { ActionRecord, Specialty } from "./types";

export interface SessionPayload {
  v: 1;
  /** Public session id. */
  sid: string;
  /** Owning user id — a token only works for the account that started it. */
  u: string;
  /** Case number shown to the player. */
  n: number;
  /** Specialty, when the player chose it. */
  sp?: Specialty;
  src: CaseSource;
  /** Intent-resolved action log. */
  a: ActionRecord[];
  /** Created at (ms since epoch). */
  t: number;
  /** Country the case is set in (India when absent). Fixed for the life of the case. */
  c?: Country;
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const PREFIX = "c1";
let warned = false;

function key(): Buffer {
  const secret = process.env.RAMAI_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // No secret of its own: derive one from the cloud database's token, which is just as private.
    // Setting RAMAI_SESSION_SECRET later is still better — it then takes over (open cases restart).
    const dbToken = remoteDatabase()?.authToken;
    if (dbToken && dbToken.length >= 32) return createHmac("sha256", dbToken).update("ramai/session-key/v1").digest();
    if (process.env.NODE_ENV === "production") {
      throw new ConfigError("RAMAI_SESSION_SECRET must be set to at least 32 characters in production.");
    }
    if (!warned) {
      warned = true;
      console.warn("[ramai] RAMAI_SESSION_SECRET is not set — using an insecure development key.");
    }
    return createHash("sha256").update("clinical/development-only/insecure").digest();
  }
  return createHash("sha256").update("clinical/session/v1:").update(secret).digest();
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");

export function seal(payload: SessionPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plain = deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [PREFIX, b64(iv), b64(cipher.getAuthTag()), b64(body)].join(".");
}

export function unseal(token: string): SessionPayload {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) throw new SessionError("Malformed session.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), unb64(parts[1]!));
    decipher.setAuthTag(unb64(parts[2]!));
    const plain = Buffer.concat([decipher.update(unb64(parts[3]!)), decipher.final()]);
    const payload = JSON.parse(inflateRawSync(plain).toString("utf8")) as SessionPayload;
    if (payload.v !== 1 || !Array.isArray(payload.a) || !payload.src) throw new Error("shape");
    return payload;
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new SessionError("Session could not be verified.");
  }
}
