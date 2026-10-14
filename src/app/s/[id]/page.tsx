import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPage } from "@/components/shell/public-page";
import { achievementCard, progressCard, readShareId, resultCard } from "@/server/share";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const share = readShareId(id);
  if (!share) return null;
  return share.kind === "r" ? resultCard(Number(share.value)) : share.kind === "a" ? achievementCard(share.value) : progressCard(share.value);
}

/** A shared result or progress card: the picture, and what RamAI is — with a preview wherever the link is posted. */
/** The card style the sharer chose travels with the link (?s=monitor) — its preview and picture match what they shared. */
const styleParam = (s: string | string[] | undefined) => (s === "monitor" || s === "badge" ? `&s=${s}` : "");

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string | string[] }> }): Promise<Metadata> {
  const { id } = await params;
  const style = styleParam((await searchParams).s);
  const card = await load(id);
  if (!card) return { title: "RamAI" };
  const title =
    card.kind === "result"
      ? `${card.name} scored ${card.score}/100${card.daily ? ` on daily case #${card.daily.number}` : card.diagnosis ? ` — ${card.diagnosis}` : ""}`
      : card.kind === "achievement"
        ? card.prize.kind === "rank" ? `${card.name} was promoted to ${card.prize.label} on RamAI` : `${card.name} unlocked “${card.prize.label}” on RamAI`
        : `${card.name} — ${card.rank} on RamAI`;
  const description = "Clinical cases with hidden diagnoses — take the history, examine, test and treat, then see what you missed. Try one free.";
  const image = { url: `/api/share/${id}/card?f=wide${style}`, width: 1200, height: 630, alt: title };
  return { title, description, openGraph: { title, description, images: [image], type: "website" }, twitter: { card: "summary_large_image", title, description, images: [image.url] } };
}

export default async function SharedCard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string | string[] }> }) {
  const { id } = await params;
  const style = styleParam((await searchParams).s);
  const card = await load(id);
  if (!card) notFound();
  return (
    <PublicPage>
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/share/${id}/card?f=square${style}`} alt={card.kind === "result" ? `${card.name}'s result: ${card.score} out of 100` : card.kind === "achievement" ? `${card.name}: ${card.prize.label}` : `${card.name}'s progress on RamAI`} width={1080} height={1080} className="h-auto w-full rounded-3xl shadow-[0_30px_80px_-30px_rgb(0_0_0/0.55)]" />
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Can you do better?</h1>
          <p className="mt-2 text-[15px] leading-6 text-fg-2">A patient with a hidden diagnosis. Take the history, examine, order tests and treat — then see your score out of 100.</p>
        </div>
        <Link href="/" className="shine inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white shadow-glow">
          Try a case free
        </Link>
      </div>
    </PublicPage>
  );
}
