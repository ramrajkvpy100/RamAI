import "server-only";

import type { PictureType } from "@/engine/types";

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
}

export async function drawPicture(p: PictureBrief): Promise<{ mime: string; base64: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OpenAI key");
  const prompt = `${STYLE[p.type]}\nView: ${p.view}.\n${p.describe}\nNo text, labels, measurements, arrows, rulers or watermarks in the image (an X-ray may carry a small side marker).`;
  const res = await fetch(`${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare", prompt, n: 1, size: "1024x1024", quality: "medium", output_format: "jpeg", output_compression: 82 }),
    signal: AbortSignal.timeout(55_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { code?: string; message?: string } };
  const base64 = json.data?.[0]?.b64_json;
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
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { code?: string } };
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

/**
 * Draws it, then the model looks at it before the doctor does. If it doesn't
 * look real or doesn't show the findings, a real image (Wikimedia Commons,
 * freely licensed, credited) takes its place — or it's drawn once more.
 */
export async function makePicture(p: PictureBrief): Promise<{ mime: string; base64: string; credit?: Credit }> {
  const started = Date.now();
  const drawn = await drawPicture(p);
  const review = await reviewPicture(drawn, p).catch(() => null);
  if (!review || review.ok) return drawn;
  const accept = (image: { mime: string; base64: string }) => reviewPicture(image, p).then((r) => r.ok).catch(() => false);
  // Most specific first: the checker's own words, then the kind of image and the condition.
  const kind = KIND[p.type];
  const real = await findRealImage([review.search, p.topic ? `${kind} ${p.topic}` : "", p.topic ? `${p.topic} ${kind}` : "", `${kind} ${p.view}`], accept, 15_000);
  if (real) return real;
  if (Date.now() - started > 28_000) return drawn;
  const again = await drawPicture({ ...p, describe: `${p.describe}\nAvoid the last attempt's problems: ${review.problems}` }).catch(() => null);
  if (!again) return drawn;
  const second = await reviewPicture(again, p).catch(() => null);
  return second && second.score > review.score ? again : drawn;
}
