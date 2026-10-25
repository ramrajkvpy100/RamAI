/** A new version went live while this page was open: its old code files are gone. Reload once to get the new ones. */
export function isStaleBuild(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem("ramai.reloaded") ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem("ramai.reloaded", String(Date.now()));
  } catch {}
  window.location.reload();
  return true;
}

