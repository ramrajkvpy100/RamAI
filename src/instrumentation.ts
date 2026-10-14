/** Runs once when the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { scheduleBackups } = await import("./server/backup-schedule");
  scheduleBackups();
}
