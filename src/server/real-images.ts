import "server-only";

import { SITE } from "@/lib/site";

/**
 * A real clinical image from Wikimedia Commons — for when a drawn picture isn't
 * realistic enough. Commons hosts only freely licensed files that may be used
 * commercially; CC BY and CC BY-SA ask for credit, which is shown under the
 * picture. Files that look like diagrams or carry arrows and labels are
 * skipped, and each candidate is checked against the case before it's used.
 */
const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = `${SITE.name}/1.0 (${SITE.url}) clinical-teaching-images`;
const LICENSE_OK = /^(cc0|public domain|pd|cc[ -]by(-sa)?[ -]?[1-4]\.0)/i;
const UNWANTED = /\b(arrows?|annotat\w*|label+ed|labels?|diagram|illustration|drawing|schematic|cartoon|collage|comparison|montage|animation|sketch|scheme|graph|chart|logo|icon|3d|render\w*)\b/i;

export interface Credit {
  author: string;
  license: string;
  /** The file's page on Commons. */
  source: string;
}

interface Page {
  title: string;
  imageinfo?: { thumburl?: string; url: string; mime: string; width: number; height: number; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[];
}

const plain = (html = "") =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A real image for the first of `queries` (most specific first) that has one passing `accept` — with its credit. */
export async function findRealImage(queries: string[], accept: (image: { mime: string; base64: string }) => Promise<boolean>, budgetMs = 15_000): Promise<{ mime: string; base64: string; credit: Credit } | null> {
  const deadline = Date.now() + budgetMs;
  const tried = new Set<string>();
  for (const q of queries.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    if (tried.has(q.toLowerCase()) || Date.now() > deadline - 1500) continue;
    tried.add(q.toLowerCase());
    const found = await searchOnce(q, accept, deadline);
    if (found) return found;
  }
  return null;
}

async function searchOnce(query: string, accept: (image: { mime: string; base64: string }) => Promise<boolean>, deadline: number): Promise<{ mime: string; base64: string; credit: Credit } | null> {
  const left = () => Math.max(500, deadline - Date.now());
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: "15",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1024",
  });
  let pages: Page[];
  try {
    const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(Math.min(5000, left())) });
    const json = (await res.json()) as { query?: { pages?: Record<string, Page & { index?: number }> } };
    pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  } catch {
    return null;
  }
  const candidates = pages
    .map((p) => ({ p, info: p.imageinfo?.[0] }))
    .filter(({ p, info }) => {
      if (!info || !/^image\/(jpeg|png)$/.test(info.mime) || info.width < 400 || info.height < 400) return false;
      const meta = info.extmetadata ?? {};
      const license = plain(meta.LicenseShortName?.value);
      const words = `${p.title} ${plain(meta.ImageDescription?.value)} ${plain(meta.ObjectName?.value)}`;
      return LICENSE_OK.test(license) && !UNWANTED.test(words);
    })
    .slice(0, 3);
  for (const { info } of candidates) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetch(info!.thumburl ?? info!.url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(Math.min(5000, left())) });
      if (!res.ok) continue;
      const image = { mime: info!.mime, base64: Buffer.from(await res.arrayBuffer()).toString("base64") };
      if (!(await accept(image))) continue;
      const meta = info!.extmetadata ?? {};
      return { ...image, credit: { author: plain(meta.Artist?.value).slice(0, 80) || "Unknown author", license: plain(meta.LicenseShortName?.value).slice(0, 40), source: info!.descriptionurl } };
    } catch {
      /* the next one */
    }
  }
  return null;
}
