import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";

import { afterAll, describe, expect, it } from "vitest";

const work = mkdtempSync(path.join(tmpdir(), "ramai-backup-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const dbPath = path.join(work, "ramai.db");
const backups = path.join(work, "backups");
const mirror = path.join(work, "mirror");
const env = { ...process.env, RAMAI_DB_PATH: dbPath, RAMAI_BACKUP_DIR: backups, RAMAI_BACKUP_KEEP: "2", RAMAI_BACKUP_MIRROR_DIR: mirror };
const run = (script: string, ...args: string[]) => execFileSync(process.execPath, ["--no-warnings", path.join("scripts", script), ...args], { env, encoding: "utf8" });
const userCount = (file: string) => {
  const db = new DatabaseSync(file);
  const n = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  db.close();
  return n;
};

function seed(users: number) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT); CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY, user_id TEXT); DELETE FROM users;");
  const insert = db.prepare("INSERT INTO users (id, name) VALUES (?, ?)");
  for (let i = 0; i < users; i++) insert.run(`u${i}`, `Doctor ${i}`);
  return db;
}

describe("database backups", () => {
  it("snapshots a live database, verifies it, and keeps only the newest", () => {
    const live = seed(3); // left open, as the running server would
    run("backup.mjs");
    run("backup.mjs");
    run("backup.mjs");
    live.close();
    const kept = readdirSync(backups).filter((f) => f.endsWith(".db.gz"));
    expect(kept).toHaveLength(2);
    expect(readdirSync(mirror).filter((f) => f.endsWith(".db.gz"))).toHaveLength(2);
    const restored = path.join(work, "check.db");
    writeFileSync(restored, gunzipSync(readFileSync(path.join(backups, kept.sort().at(-1)!))));
    expect(userCount(restored)).toBe(3);
  });

  it("skips a scheduled run while the newest backup is recent", () => {
    const before = readdirSync(backups).length;
    run("backup.mjs", "--if-older-than", "24");
    expect(readdirSync(backups).length).toBe(before);
  });

  it("restores the latest backup and keeps the replaced database", () => {
    seed(1).close();
    expect(userCount(dbPath)).toBe(1);
    run("restore.mjs", "latest");
    expect(userCount(dbPath)).toBe(3);
    expect(readdirSync(work).some((f) => f.startsWith("ramai.db.before-restore-") && !f.endsWith("-wal") && !f.endsWith("-shm"))).toBe(true);
    expect(existsSync(`${dbPath}-wal`)).toBe(false);
  });
});
