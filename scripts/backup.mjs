#!/usr/bin/env node
/**
 * RamAI database backup.
 *
 *   npm run backup                          back up now
 *   npm run backup -- --list                list backups
 *   npm run backup -- --if-older-than 24    only if the newest is older than 24 h
 *                                           (what the server's daily schedule runs)
 *
 * SQLite's VACUUM INTO writes a consistent snapshot even while the app is
 * running. The copy is checked with PRAGMA integrity_check, gzipped into
 * RAMAI_BACKUP_DIR (default data/backups), and only the newest
 * RAMAI_BACKUP_KEEP (default 14) are kept. Set RAMAI_BACKUP_MIRROR_DIR to a
 * synced folder (Google Drive, Dropbox, iCloud) or another disk so a copy also
 * lives off this machine.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const dbPath = process.env.RAMAI_DB_PATH || path.join(root, "data", "ramai.db");
const dir = process.env.RAMAI_BACKUP_DIR || path.join(root, "data", "backups");
const keep = Math.max(1, Number(process.env.RAMAI_BACKUP_KEEP) || 14);
const mirror = process.env.RAMAI_BACKUP_MIRROR_DIR || "";
const PREFIX = "ramai-";
const SUFFIX = ".db.gz";

/** Backups in a folder, oldest first (names are ISO timestamps). */
export function listBackups(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter((f) => f.startsWith(PREFIX) && f.endsWith(SUFFIX)).sort();
}

function prune(folder) {
  const all = listBackups(folder);
  for (const old of all.slice(0, Math.max(0, all.length - keep))) rmSync(path.join(folder, old), { force: true });
}

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-IN")} KB`;

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    const all = listBackups(dir);
    if (all.length === 0) console.log(`No backups in ${dir}`);
    for (const f of all) console.log(`${f}  ${kb(statSync(path.join(dir, f)).size)}`);
    return;
  }

  const olderIdx = args.indexOf("--if-older-than");
  if (olderIdx >= 0) {
    const hours = Number(args[olderIdx + 1]) || 24;
    const newest = listBackups(dir).at(-1);
    if (newest && Date.now() - statSync(path.join(dir, newest)).mtimeMs < hours * 3_600_000) return;
  }

  if (!existsSync(dbPath)) throw new Error(`no database at ${dbPath}`);
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tmp = path.join(dir, `.${PREFIX}${stamp}.db.tmp`);
  const out = path.join(dir, `${PREFIX}${stamp}${SUFFIX}`);
  try {
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);
    db.close();

    const copy = new DatabaseSync(tmp);
    const verdict = Object.values(copy.prepare("PRAGMA integrity_check").get())[0];
    const count = (table) => copy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const users = count("users");
    const results = count("results");
    copy.close();
    if (verdict !== "ok") throw new Error(`integrity check failed: ${verdict}`);

    writeFileSync(out, gzipSync(readFileSync(tmp), { level: 9 }));
    prune(dir);
    if (mirror) {
      mkdirSync(mirror, { recursive: true });
      copyFileSync(out, path.join(mirror, path.basename(out)));
      prune(mirror);
    }
    console.log(`[backup] ${path.relative(root, out) || out} · ${kb(statSync(out).size)} · ${users} users, ${results} results${mirror ? ` · copied to ${mirror}` : ""}`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[backup] failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
