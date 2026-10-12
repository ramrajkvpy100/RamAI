import type { Metadata } from "next";

import { CommunityFeed } from "@/components/community/community-feed";
import { PublicPage } from "@/components/shell/public-page";
import { TOPIC_IDS, type Topic } from "@/lib/community";
import { getCurrentUser } from "@/server/auth";
import { listPosts } from "@/server/community";

export const metadata: Metadata = { title: "Community", description: "Case discussions, NEET PG and INI-CET, USMLE, UKMLA and PLAB — with doctors and students from India, the USA and the UK." };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** The community feed — open to everyone; posting needs a free account. "?compose=1&…" opens a draft (from the end of a case). */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  const { posts, more } = await listPosts({ viewerId: user?.id });
  const topic = one(params.topic);
  const draft =
    one(params.compose) === "1"
      ? {
          topic: TOPIC_IDS.includes(topic as Topic) ? (topic as Topic) : undefined,
          title: one(params.title)?.slice(0, 140),
          body: one(params.body)?.slice(0, 2000),
          shareId: one(params.share) ?? null,
          spoiler: one(params.spoiler) === "1",
        }
      : undefined;
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <CommunityFeed initial={posts} more={more} guest={!!user?.isGuest} signedIn={!!user} draft={draft} />
      </div>
    </PublicPage>
  );
}
