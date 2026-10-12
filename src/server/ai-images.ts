import "server-only";

import type { PictureType } from "@/engine/types";

/**
 * Draws one clinical picture with OpenAI's image model, at the moment a case
 * reaches it. Medium quality by the owner's choice. The image model is
 * OPENAI_IMAGE_MODEL, gpt-image-2.5-flare by default: as realistic as
 * gpt-image-2 but about four times faster (~11 s) and ~1.3 cents a picture.
 */
const STYLE: Record<PictureType, string> = {
  photo:
    "A realistic clinical photograph for a medical teaching file, taken with a good phone camera in an Indian clinic under soft daylight. True-to-life skin texture, pores, hair and colour; natural and unretouched; plain background.",
  xray: "A realistic plain radiograph (X-ray) as it appears on a hospital PACS screen: grayscale, authentic radiographic densities, exposure and slight quantum noise, anatomically accurate.",
  ct: "A realistic axial CT slice as it appears on a hospital PACS screen, grayscale with an appropriate window, anatomically accurate.",
  mri: "A realistic MRI slice as it appears on a hospital PACS screen, grayscale, anatomically accurate, appropriate sequence contrast.",
  usg: "A realistic B-mode ultrasound image as it appears on the machine's screen: grayscale speckle, the probe's fan or rectangular field, anatomically accurate.",
  fundus: "A realistic colour fundus photograph: circular field, orange-red retina, optic disc and vessels, anatomically accurate.",
  endoscopy: "A realistic endoscopy still image: circular field, wet mucosa with natural specular highlights, anatomically accurate.",
  slide: "A realistic histopathology micrograph (H&E stain) under a light microscope, true tissue architecture and staining.",
};

export async function drawPicture(p: { type: PictureType; view: string; describe: string }): Promise<{ mime: string; base64: string }> {
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
