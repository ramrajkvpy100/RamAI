/** Where the radiology images live: public, read-only, and outside each deployment so a deploy stays small. Not a secret. */
export const SCAN_HOST = "https://pub-6c5f80bbadbf438781a45ec27a6ac07b.r2.dev";
export const SCAN_BASE = SCAN_HOST;

/** A scan's address, from its path inside the library ("/radiology/singles/nof/2.jpg" or "lung-ca-ct-4/000.jpg"). */
export const scanUrl = (path: string) => `${SCAN_BASE}/${path.replace(/^\/?radiology\//, "").replace(/^\//, "")}`;
