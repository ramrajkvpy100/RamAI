#!/usr/bin/env node
/**
 * Restores a backup made by scripts/backup.mjs. Stop the RamAI server first.
 *
 *   npm run restore -- latest
 *   npm run restore -- data/backups/ramai-2026-10-09T03-00-00-000Z.db.gz
 *
 * The backup is checked before anything is touched. The current database is
 * kept beside it as ramai.db.before-restore-<time>, so a restore can itself
 * be undone.
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";

const root = process.cwd();
const dbPath = process.env.RAMAI_DB_PATH || path.join(root, "data", "ramai.db");
const dir = process.env.RAMAI_BACKUP_DIR || path.join(root, "data", "backups");

function main() {
  const arg = process.argv[2];
  if (!arg) throw new Error("say which backup: `npm run restore -- latest` or a file path");
  let file = arg;
  if (arg === "latest") {
    const all = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("ramai-") && f.endsWith(".db.gz")).sort() : [];
    if (all.length === 0) throw new Error(`no backups in ${dir}`);
    file = path.join(dir, all.at(-1));
  }
  file = path.resolve(file);
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tmp = `${dbPath}.restoring-${stamp}`;
  try {
    const raw = readFileSync(file);
    writeFileSync(tmp, file.endsWith(".gz") ? gunzipSync(raw) : raw);
    const db = new DatabaseSync(tmp);
    const verdict = Object.values(db.prepare("PRAGMA integrity_check").get())[0];
    const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    db.close();
    if (verdict !== "ok") throw new Error(`the backup failed its integrity check: ${verdict}`);

    // Keep the current database (and its write-ahead log) so the restore can be undone.
    for (const suffix of ["", "-wal", "-shm"]) {
      if (existsSync(dbPath + suffix)) renameSync(dbPath + suffix, `${dbPath}.before-restore-${stamp}${suffix}`);
    }
    renameSync(tmp, dbPath);
    console.log(`[restore] restored ${path.basename(file)} (${users} users) → ${path.relative(root, dbPath) || dbPath}`);
    console.log(`[restore] the previous database is kept as ${path.basename(dbPath)}.before-restore-${stamp}. Start the server again.`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

try {
  main();
} catch (err) {
  console.error(`[restore] failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
}
