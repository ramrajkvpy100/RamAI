/** Runs work that can wait until the page is up and the phone is free (at most `most` ms later). Returns how to cancel it. */
export function whenIdle(work: () => void, most = 1500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(work, { timeout: most });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, most);
  return () => window.clearTimeout(id);
}
