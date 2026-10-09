/**
 * Daily database backups while the server runs. Each run is a separate
 * `scripts/backup.mjs` process, so a slow backup never blocks requests.
 *
 *   RAMAI_BACKUP_INTERVAL_HOURS   hours between backups (default 24; 0 turns it off)
 *
 * Restarts don't pile up backups: a run is skipped while the newest backup is
 * younger than the interval.
 */
import { spawn } from "node:child_process";
import path from "node:path";

export function scheduleBackups() {
  const g = globalThis as unknown as { __ramaiBackups?: boolean };
  if (g.__ramaiBackups) return;
  g.__ramaiBackups = true;
  const hours = Number(process.env.RAMAI_BACKUP_INTERVAL_HOURS ?? 24);
  if (!(hours > 0)) return;
  const script = path.join(process.cwd(), "scripts", "backup.mjs");
  const run = () => {
    const child = spawn(process.execPath, ["--no-warnings", script, "--if-older-than", String(hours)], { stdio: "inherit", env: process.env });
    child.on("error", (err) => console.error("[backup] could not start:", err.message));
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, hours * 3_600_000).unref();
}
