import { ImageResponse } from "next/og";

import { AchievementCardImage, CARD_SIZE, cardFonts, heartImage, ProgressCardImage, ResultCardImage, type CardFormat } from "@/server/share-card";
import { BadgeCardImage, CARD_STYLES, MonitorCardImage, type CardStyle } from "@/server/share-styles";
import { achievementCard, progressCard, readShareId, resultCard } from "@/server/share";
import { rateLimited } from "@/lib/server/http";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

/** GET /api/share/:id/card?f=story|square|wide&s=collectible|monitor|badge — the shareable picture. Public: the signed id is the permission. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rateLimited(req, 60);
  if (blocked) return blocked;
  const share = readShareId((await params).id);
  if (!share) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const f = q.get("f");
  const format: CardFormat = f === "square" || f === "wide" ? f : "story";
  const style: CardStyle = CARD_STYLES.includes(q.get("s") as CardStyle) ? (q.get("s") as CardStyle) : "collectible";
  const site = new URL(SITE.url).host;
  if (share.kind === "a") {
    const achievement = await achievementCard(share.value);
    if (!achievement) return new Response("Not found", { status: 404 });
    const [img, fonts] = await Promise.all([heartImage(), cardFonts()]);
    return new ImageResponse(<AchievementCardImage card={achievement} format={format} site={site} img={img} />, { ...CARD_SIZE[format], fonts, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
  }
  const card = share.kind === "r" ? await resultCard(Number(share.value)) : await progressCard(share.value);
  if (!card) return new Response("Not found", { status: 404 });
  const [img, fonts] = await Promise.all([heartImage(), cardFonts()]);
  const element =
    style === "monitor" ? (
      <MonitorCardImage card={card} format={format} site={site} />
    ) : style === "badge" ? (
      <BadgeCardImage card={card} format={format} site={site} />
    ) : card.kind === "result" ? (
      <ResultCardImage card={card} format={format} site={site} img={img} />
    ) : (
      <ProgressCardImage card={card} format={format} site={site} img={img} />
    );
  return new ImageResponse(element, {
    ...CARD_SIZE[format],
    fonts,
    // A result never changes; progress does. Either way the picture is kept close to whoever opens it.
    headers: { "Cache-Control": share.kind === "r" ? "public, max-age=86400, s-maxage=86400" : "public, max-age=600, s-maxage=600" },
  });
}
