import "server-only";

import { createHash } from "node:crypto";

import { noteUsage } from "@/engine/providers/usage";
import type { PictureType } from "@/engine/types";

import { db } from "./db";
import { findRealImage, type Credit } from "./real-images";

/**
 * Draws one clinical picture with OpenAI's image model, at the moment a case
 * reaches it. Medium quality by the owner's choice. The image model is
 * OPENAI_IMAGE_MODEL, gpt-image-2.5-flare by default: as realistic as
 * gpt-image-2 but about four times faster (~11 s) and ~1.3 cents a picture.
 */
const STYLE: Record<PictureType, string> = {
  photo:
    "A realistic clinical photograph for a medical teaching file, taken with a good phone camera in an Indian clinic under soft daylight. True-to-life skin texture, pores, hair and colour; natural and unretouched; plain background.",
  xray: "A real plain radiograph (X-ray) exactly as it appears on a hospital PACS monitor: grayscale, authentic radiographic densities and exposure, faint quantum mottle, true anatomy and proportions for the patient's age and sex, black background beyond the collimation.",
  ct: "A real axial CT image exactly as it appears on a hospital PACS monitor: grayscale with the appropriate window for the region, the scanner's circular field of view on black, true anatomy at that level, fine image noise.",
  mri: "A real MRI image exactly as it appears on a hospital PACS monitor: grayscale, the right signal contrast for the sequence, true anatomy at that level, black background.",
  usg: "A real B-mode ultrasound image exactly as it appears on the ultrasound machine's screen: a grayscale fan-shaped (curvilinear or phased array) or rectangular (linear) sector on black, fine speckle texture, acoustic shadowing and enhancement where tissue causes them, true sonographic anatomy; Doppler colour only where the view is a Doppler study.",
  fundus: "A real colour fundus photograph from a retinal camera: circular field on black, orange-red retina, optic disc, macula and vessels in true proportion.",
  endoscopy: "A real endoscopy still image from a video endoscope: circular or octagonal field on black, wet mucosa with natural specular highlights, true mucosal colour and anatomy.",
  slide: "A real histopathology micrograph (H&E stain) under a light microscope: true tissue architecture, nuclear detail and staining.",
};

/** How each kind of picture is named in an image search. */
const KIND: Record<PictureType, string> = { photo: "clinical photograph", xray: "radiograph", ct: "CT", mri: "MRI", usg: "ultrasound", fundus: "fundus photograph", endoscopy: "endoscopy", slide: "histopathology" };

export interface PictureBrief {
  type: PictureType;
  view: string;
  /** What the picture must show — never shown to the player. */
  describe: string;
  /** Server-only context for finding a real image: the case's diagnosis. */
  topic?: string;
  /** How the picture should look, when the type's usual style doesn't fit (a blood smear isn't H&E). */
  style?: string;
  /** Drawn, never searched for: a portrait of an invented person must not be a real one. */
  aiOnly?: boolean;
}

export async function drawPicture(p: PictureBrief, timeoutMs = 55_000): Promise<{ mime: string; base64: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OpenAI key");
  const prompt = `${p.style ?? STYLE[p.type]}\nView: ${p.view}.\n${p.describe}\nNo text, labels, measurements, arrows, rulers or watermarks in the image (an X-ray may carry a small side marker).`;
  const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare", prompt, n: 1, size: "1024x1024", quality: "medium", output_format: "jpeg", output_compression: 82 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; usage?: unknown; error?: { code?: string; message?: string } };
  const base64 = json.data?.[0]?.b64_json;
  if (res.ok) noteUsage(json.usage, 1);
  if (!res.ok || !base64) throw new Error(`Image model answered ${res.status}${json.error?.code ? ` (${json.error.code})` : ""}`);
  return { mime: "image/jpeg", base64 };
}

export interface PictureReview {
  /** Good enough to show: looks real, shows what it must, carries no labels. */
  ok: boolean;
  score: number;
  problems: string;
  /** A few words to find a real image of the same thing (Wikimedia Commons). */
  search: string;
}

/**
 * The model looks at a picture before the doctor does: does it look like a
 * real image of this kind, does it show exactly what the case says, and is it
 * free of text and arrows? (gpt-6-luna, a low-detail look: ~4 s, a fraction of a cent.)
 */
export async function reviewPicture(image: { mime: string; base64: string }, p: PictureBrief): Promise<PictureReview> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OpenAI key");
  const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna",
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_completion_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You check images for a clinical teaching simulator before a doctor sees them. The image should be a ${p.type === "usg" ? "ultrasound" : p.type === "xray" ? "plain radiograph" : p.type} — ${p.view}: "${p.describe}"${p.topic ? ` (the case: ${p.topic})` : ""}.
Return JSON {"realistic": 1-10 (does it look like a real clinical image of this kind, not a drawing or render), "matches": 1-10 (does it clearly show exactly the findings described, and no others), "labels": true|false (any text, arrows, letters or annotations apart from a small side marker), "problems": "a short phrase", "search": "3–7 English keywords to find a real image of the same finding on Wikimedia Commons (modality, region, finding, condition)"}`,
            },
            { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}`, detail: "low" } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: unknown; error?: { code?: string } };
  noteUsage(json.usage);
  const content = json.choices?.[0]?.message?.content;
  if (!res.ok || !content) throw new Error(`Picture review answered ${res.status}${json.error?.code ? ` (${json.error.code})` : ""}`);
  const r = JSON.parse(content) as { realistic?: number; matches?: number; labels?: boolean; problems?: string; search?: string };
  const realistic = Number(r.realistic) || 0;
  const matches = Number(r.matches) || 0;
  return {
    ok: realistic >= 6 && matches >= 6 && r.labels !== true,
    score: Math.min(realistic, matches) - (r.labels ? 3 : 0),
    problems: String(r.problems ?? "").slice(0, 200),
    search: String(r.search ?? "").replace(/[^\p{L}\p{N} -]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80),
  };
}

/** What one picture may take, inside the request's 60 seconds. */
const PICTURE_BUDGET_MS = 54_000;

/**
 * A real picture first: a freely licensed image from the internet (Wikimedia Commons) that the model
 * agrees shows exactly this finding, credited. Only when none can be found is one drawn by the image
 * model — checked the same way, and drawn once more if the first attempt doesn't pass.
 */
export async function makePicture(p: PictureBrief, budgetMs = PICTURE_BUDGET_MS): Promise<{ mime: string; base64: string; credit?: Credit; checked: boolean }> {
  // Everything has to fit in one request (the server stops it at 60 s): each step gets what's left.
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  const accept = (image: { mime: string; base64: string }) => reviewPicture(image, p).then((r) => r.ok).catch(() => false);
  const kind = KIND[p.type];
  // Plain names find far more on Commons ("psoriasis", not "clinical photograph of psoriasis on the elbow"); skin photos get longer to look.
  const plain = p.topic?.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const real = p.aiOnly ? null : await findRealImage([p.type === "photo" && plain ? plain : "", p.topic ? `${kind} ${p.topic}` : "", p.topic ? `${p.topic} ${kind}` : "", p.topic ? `${p.view} ${p.topic}` : "", `${kind} ${p.view}`].filter(Boolean), accept, p.type === "photo" ? 18_000 : 10_000);
  if (real) return { ...real, checked: true };
  const drawn = await drawPicture(p, Math.max(15_000, left() - 2_000));
  // Checked, and drawn again, only while there's time for it: a picture shown beats a better one cut off.
  if (left() < 8_000) return { ...drawn, checked: false };
  const review = await Promise.race([reviewPicture(drawn, p).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, left() - 3_000)))]);
  if (!review || review.ok) return { ...drawn, checked: !!review };
  if (left() < 30_000) return { ...drawn, checked: false };
  const again = await drawPicture({ ...p, describe: `${p.describe}\nAvoid the last attempt's problems: ${review.problems}` }, left() - 6_000).catch(() => null);
  if (!again) return { ...drawn, checked: false };
  const second = await Promise.race([reviewPicture(again, p).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), Math.max(0, left() - 2_000)))]);
  return second && second.score > review.score ? { ...again, checked: second.ok } : { ...drawn, checked: false };
}

/**
 * A case's picture from the shared library: every case asking for exactly the same picture (same kind,
 * view, findings and diagnosis — word for word) gets the one already found or drawn, at once and for
 * nothing. Only pictures the model checked are kept; a picture that failed its check is made afresh
 * next time, so accuracy is never traded for the saving.
 */
export async function libraryPicture(p: PictureBrief): Promise<{ mime: string; base64: string; credit?: Credit }> {
  const brief = createHash("sha256").update(JSON.stringify([p.type, p.view.trim(), p.describe.trim(), p.topic?.trim() ?? "", p.style ?? ""])).digest("hex");
  const kept = await db.get<{ mime: string; data: string; credit: string | null }>("SELECT mime, data, credit FROM picture_library WHERE brief = ?", brief).catch(() => undefined);
  if (kept) {
    void db.run("UPDATE picture_library SET uses = uses + 1 WHERE brief = ?", brief).catch(() => undefined);
    return { mime: kept.mime, base64: kept.data, credit: kept.credit ? (JSON.parse(kept.credit) as Credit) : undefined };
  }
  const { checked, ...made } = await makePicture(p);
  if (checked || p.aiOnly) {
    await db
      .run("INSERT OR IGNORE INTO picture_library (brief, mime, data, credit, source, uses, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)", brief, made.mime, made.base64, made.credit ? JSON.stringify(made.credit) : null, made.credit ? "commons" : "ai", Date.now())
      .catch(() => undefined);
  }
  return made;
}
