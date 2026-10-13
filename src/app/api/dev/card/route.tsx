import { ImageResponse } from "next/og";

import { avatarOf } from "@/lib/avatar";
import { CARD_SIZE, cardFonts, heartImage, ProgressCardImage, ResultCardImage, type CardFormat } from "@/server/share-card";
import { BadgeCardImage, MonitorCardImage, type CardStyle } from "@/server/share-styles";
import type { ProgressCard, ResultCard } from "@/server/share";

export const runtime = "nodejs";

/** Development only: sample share cards in every style and size — /api/dev/card?s=badge&f=story&k=result. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const format = (q.get("f") ?? "story") as CardFormat;
  const style = (q.get("s") ?? "collectible") as CardStyle;
  const result: ResultCard = { kind: "result", caseNumber: 42, name: "Dr. Asha", avatar: avatarOf("Asha Verma"), tier: 4, score: Number(q.get("score") ?? 87), xp: 142, verdict: "correct", diagnosis: q.get("dx") ?? "Acute pancreatitis", daily: null, specialty: "Gastroenterology", level: "District Hospital", mode: "Emergency", minutes: 18, rank: "Junior Resident", streak: 5 };
  const progress: ProgressCard = { kind: "progress", name: "Dr. Asha", avatar: avatarOf("Asha Verma"), rank: "Junior Resident", tier: 3, xp: 2440, cases: 23, average: 74, bestStreak: 9, streak: 5, badges: ["First case", "Sharp eye", "Week streak"], specialties: [{ name: "Medicine", percent: 72 }, { name: "Surgery", percent: 58 }] };
  const card = q.get("k") === "progress" ? progress : result;
  const [img, fonts] = await Promise.all([heartImage(), cardFonts()]);
  const site = "ram-ai-liard.vercel.app";
  const element =
    style === "monitor" ? <MonitorCardImage card={card} format={format} site={site} /> : style === "badge" ? <BadgeCardImage card={card} format={format} site={site} /> : card.kind === "result" ? <ResultCardImage card={card} format={format} site={site} img={img} /> : <ProgressCardImage card={card} format={format} site={site} img={img} />;
  return new ImageResponse(element, { ...CARD_SIZE[format], fonts });
}
