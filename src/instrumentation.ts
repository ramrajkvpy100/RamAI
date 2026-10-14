/** Runs once when the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Before any case is opened: the sealing key every server shares.
  const { loadSessionKey } = await import("./server/session-key");
  await loadSessionKey().catch((err) => console.error("[ramai] session key not loaded:", err instanceof Error ? err.message : err));
  const { scheduleBackups } = await import("./server/backup-schedule");
  scheduleBackups();
}
