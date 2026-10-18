/**
 * Collects candidate single images (X-ray, CT, ultrasound) for the radiology reporting cases from
 * Wikimedia Commons — freely licensed only (CC0, public domain, CC BY, CC BY-SA), no AI — into
 * public/radiology/singles/<item>/. Every candidate is then looked at by a person; only those kept
 * in src/lib/radiology-singles.json are shown. Run: node scripts/radiology-singles.mjs [item ...]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "RamAI/1.0 (medical education; radiology teaching set)";
const LICENSE_OK = /^(cc0|public domain|pd|cc[ -]by(-sa)?[ -]?[1-4]\.0)/i;
const UNWANTED = /\b(arrows?|annotat\w*|label+ed|labels?|diagram|illustration|drawing|schematic|cartoon|collage|comparison|montage|animation|sketch|scheme|graph|chart|logo|icon|3d|render\w*|histolog\w*|patholog\w*|photo of patient)\b/i;
const PER_ITEM = 6;

const practice = readFileSync("src/lib/practice.ts", "utf8");
const briefs = readFileSync("src/lib/radiology.ts", "utf8");
const ids = [...briefs.matchAll(/^\s+"?([a-z-]+)"?: \{ history:/gm)].map((m) => m[1]);
// The briefs list X-rays, then CT (from "edh"), then ultrasound (from "gallstones").
const modalityOf = (id) => (ids.indexOf(id) >= ids.indexOf("gallstones") ? "usg" : ids.indexOf(id) >= ids.indexOf("edh") ? "ct" : "xray");
const MODALITY = {
  xray: { words: ["X-ray", "radiograph"], must: /x-?ray|radiograph|roentgen|röntgen|\bcxr\b|\bpa\b|\bap\b/i },
  ct: { words: ["CT", "CT scan"], must: /\bct\b|computed tomograph|\bcect\b|\bncct\b|ctpa|angiogra/i },
  usg: { words: ["ultrasound", "sonography"], must: /ultrasound|ultrason|sonograph|\busg\b|\bus\b|doppler|echograph|fast exam/i },
};
let items = ids.map((id) => {
  const line = practice.split("\n").find((l) => l.includes(`id: "${id}"`)) ?? "";
  const label = line.match(/label: "([^"]+)"/)?.[1] ?? id;
  const search = [...(line.match(/search: \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { id, label, search, modality: modalityOf(id) };
});
// The extra modalities' cases (MRI, contrast studies, nuclear medicine), read from their own list.
const EXTRA_MODALITY = {
  mri: { words: ["MRI"], must: /\bmri\b|magnetic resonance|\bt1\b|\bt2\b|flair|\bmr\b/i },
  fluoro: { words: ["barium", "fluoroscopy"], must: /barium|swallow|enema|fluoroscop|esophagogra|oesophagogra|follow[- ]through|meal|contrast study/i },
  nuclear: { words: ["scintigraphy", "scan"], must: /scintigra|bone scan|technetium|pertechnetate|\bspect\b|nuclear|\bmdp\b|isotope|radionuclide/i },
};
for (const m of briefs.matchAll(/\{ id: "([a-z-]+)", modality: "(mri|fluoro|nuclear)", label: "([^"]+)"[^\n]*search: \[([^\]]*)\] \}/g)) {
  items.push({ id: m[1], label: m[3], search: [...m[4].matchAll(/"([^"]+)"/g)].map((x) => x[1]), modality: m[2] });
}
Object.assign(MODALITY, EXTRA_MODALITY);
const only = process.argv.slice(2);
const plain = (h) => String(h ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const out = {};
for (const it of items.filter((i) => !only.length || only.includes(i.id))) {
  const dir = path.join("public/radiology/singles", it.id);
  mkdirSync(dir, { recursive: true });
  const got = [];
  const seen = new Set();
  const m = MODALITY[it.modality];
  for (const q of [...it.search, ...m.words.map((w) => `${it.label} ${w}`)]) {
    if (got.length >= PER_ITEM) break;
    const params = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrsearch: `${q} filetype:bitmap`, gsrlimit: "20", prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist|ImageDescription|Categories", iiurlwidth: "900" });
    let pages = [];
    // Gently: Commons turns away bursts of requests.
    await new Promise((r) => setTimeout(r, 2500));
    try {
      pages = Object.values((await (await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } })).json()).query?.pages ?? {});
    } catch {
      continue;
    }
    for (const p of pages) {
      if (got.length >= PER_ITEM) break;
      const info = p.imageinfo?.[0];
      if (!info || seen.has(info.descriptionurl) || !/^image\/(jpeg|png)$/.test(info.mime) || info.width < 400 || info.height < 400) continue;
      seen.add(info.descriptionurl);
      const meta = info.extmetadata ?? {};
      const license = plain(meta.LicenseShortName?.value);
      const words = `${p.title} ${plain(meta.ImageDescription?.value)} ${plain(meta.Categories?.value)}`;
      // The right kind of study, said in the file's own title, description or categories.
      if (!LICENSE_OK.test(license) || UNWANTED.test(words) || !m.must.test(words)) continue;
      try {
        const res = await fetch(info.thumburl ?? info.url, { headers: { "User-Agent": UA } });
        if (!res.ok) continue;
        const file = `c${got.length}.${info.mime === "image/png" ? "png" : "jpg"}`;
        writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
        got.push({ file, title: p.title, author: plain(meta.Artist?.value).slice(0, 80) || "Unknown author", license, source: info.descriptionurl });
      } catch {}
    }
  }
  out[it.id] = got;
  console.log(`${it.id}: ${got.length}`);
}
writeFileSync(process.env.CANDIDATES ?? "radiology-candidates.json", JSON.stringify(out, null, 2));
