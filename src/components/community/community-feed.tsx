"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/game/avatar";
import { RankBadge } from "@/components/game/rank-badge";
import { OrganScene } from "@/components/three/heart-scene";
import { Icon } from "@/components/ui/icon";
import { TOPIC_IDS, TOPICS, type PostSummary, type Topic } from "@/lib/community";
import { cn } from "@/lib/cn";

import { ago, feed, like } from "./community-client";
import { Composer, type Draft } from "./composer";

/** One post in the feed. A spoiler stays blurred until it's opened. */
function PostCard({ post, onLike }: { post: PostSummary; onLike: () => void }) {
  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2.5 text-[12.5px] text-fg-3">
        <Avatar name={post.author.name} size={28} />
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-fg-2">{post.author.name}</span>
          <RankBadge tier={post.author.rankTier} size={15} title={post.author.rankLabel} />
        </span>
        <span aria-hidden>·</span>
        <span className="whitespace-nowrap">{ago(post.lastActivityAt)}</span>
        <span className="ml-auto hidden rounded-full bg-surface-3 px-2.5 py-0.5 text-[11.5px] font-medium text-fg-2 sm:inline">{TOPICS[post.topic].short}</span>
      </div>
      <Link href={`/community/${post.id}`} className="group mt-3 flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] leading-snug font-semibold tracking-[-0.01em] group-hover:text-accent-text">{post.title}</h3>
          {post.spoiler ? (
            <p className="mt-1 text-[13.5px] text-warning">Spoiler — open to read</p>
          ) : (
            <p className="mt-1 line-clamp-2 text-[14px] leading-6 text-fg-2">{post.excerpt}</p>
          )}
        </div>
        {post.shareId && !post.spoiler && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/share/${post.shareId}/card?f=square`} alt="Result card" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" />
        )}
      </Link>
      <div className="mt-3 flex items-center gap-4 text-[13px] text-fg-2">
        <button type="button" onClick={onLike} aria-pressed={post.liked} className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-surface-3", post.liked && "text-danger")}>
          <Icon name="star" size={14} /> {post.likes}
        </button>
        <Link href={`/community/${post.id}`} className="flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-surface-3">
          <Icon name="chat" size={14} /> {post.replies} {post.replies === 1 ? "reply" : "replies"}
        </Link>
      </div>
    </li>
  );
}

export function CommunityFeed({ initial, more: initialMore, guest, signedIn, draft }: { initial: PostSummary[]; more: boolean; guest: boolean; signedIn: boolean; draft?: Draft }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(!!draft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (topic === null && posts === initial) return;
    let live = true;
    setLoading(true);
    feed(topic ?? undefined)
      .then((r) => {
        if (!live) return;
        setPosts(r.posts);
        setMore(r.more);
      })
      .catch(() => live && setError("Couldn't load the posts. Pull to refresh, or try again."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the topic changes
  }, [topic]);

  const loadMore = async () => {
    const last = posts.at(-1);
    if (!last || loading) return;
    setLoading(true);
    try {
      const r = await feed(topic ?? undefined, last.lastActivityAt);
      setPosts((p) => [...p, ...r.posts]);
      setMore(r.more);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id: string) => {
    if (!signedIn) return setComposing(true);
    const r = await like(`p:${id}`).catch(() => null);
    if (r) setPosts((list) => list.map((p) => (p.id === id ? { ...p, liked: r.liked, likes: r.likes } : p)));
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="ink relative isolate overflow-hidden rounded-[22px] p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-10 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(6_182_212/0.30),transparent_65%)] blur-2xl" />
        {/* The lungs, breathing: whole beside the button on phones, larger on wider screens. */}
        <OrganScene organ="lungs" density="compact" tone="dark" className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[170px] w-[44%] max-w-[190px] sm:top-0 sm:h-auto sm:w-[38%] sm:max-w-none" />
        <p className="text-[13px] font-medium tracking-[0.08em] text-cyan-300/90 uppercase">Community</p>
        <h1 className="mt-2 max-w-[62%] text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:max-w-[min(36rem,58%)] sm:text-[34px]">Discuss cases. Ask. Prepare together.</h1>
        <p className="mt-2 max-w-[60%] text-[14.5px] leading-6 text-white/65 sm:max-w-[min(28rem,56%)]">Case discussions, NEET PG and INI-CET, USMLE, UKMLA and PLAB — with doctors and students from India, the USA and the UK.</p>
        <button type="button" onClick={() => setComposing(true)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-semibold text-[#0b1220] hover:bg-white/90">
          <Icon name="plus" size={16} /> New post
        </button>
      </section>

      <div role="tablist" aria-label="Topics" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {([null, ...TOPIC_IDS] as (Topic | null)[]).map((t) => (
          <button key={t ?? "all"} type="button" role="tab" aria-selected={topic === t} onClick={() => setTopic(t)} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors", topic === t ? "bg-fg text-bg" : "bg-surface-2 text-fg-2 hover:text-fg")}>
            {t ? TOPICS[t].label : "All"}
          </button>
        ))}
      </div>

      {error && <p className="text-[13.5px] text-danger">{error}</p>}
      {posts.length === 0 && !loading ? (
        <div className="panel flex flex-col items-center gap-3 p-8 text-center">
          <span className="bg-ai flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-glow">
            <Icon name="chat" size={22} />
          </span>
          <p className="text-[15px] font-semibold">Start the first discussion</p>
          <p className="max-w-sm text-[13.5px] leading-6 text-fg-2">Share a case you found tricky, a question from your exam prep, or how you approach a common presentation.</p>
          <button type="button" onClick={() => setComposing(true)} className="bg-ai mt-1 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-glow">
            <Icon name="plus" size={15} /> New post
          </button>
        </div>
      ) : (
        <ul className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onLike={() => void toggle(p.id)} />
          ))}
        </ul>
      )}
      {more && (
        <button type="button" onClick={() => void loadMore()} disabled={loading} className="self-center rounded-full bg-surface-2 px-5 py-2 text-[13.5px] font-medium hover:bg-surface-3 disabled:opacity-60">
          {loading ? "Loading…" : "Older posts"}
        </button>
      )}
      <Composer open={composing} onClose={() => setComposing(false)} draft={draft} guest={!signedIn || guest} />
    </div>
  );
}
