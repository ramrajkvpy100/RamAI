"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/game/avatar";
import { RankBadge } from "@/components/game/rank-badge";
import { Icon } from "@/components/ui/icon";
import { TOPICS, type Author, type Post, type Reply } from "@/lib/community";
import { cn } from "@/lib/cn";
import { ClinicalEngineError } from "@/lib/engine-client";

import { ago, like, newReply, removeItem, reportItem } from "./community-client";

function Byline({ author, at }: { author: Author; at: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] text-fg-3">
      <Avatar name={author.name} size={30} />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-fg">{author.name}</span>
          <RankBadge tier={author.rankTier} size={15} title={author.rankLabel} />
        </span>
        <span>
          {author.rankLabel} · {ago(at)}
        </span>
      </span>
    </div>
  );
}

/** Like · report · remove — for a post or a reply. */
function Actions({
  target,
  likes,
  liked,
  mine,
  signedIn,
  account,
  onLiked,
  onRemoved,
}: {
  target: string;
  likes: number;
  liked: boolean;
  mine: boolean;
  signedIn: boolean;
  account: boolean;
  onLiked: (r: { liked: boolean; likes: number }) => void;
  onRemoved: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
      <button
        type="button"
        aria-pressed={liked}
        title={signedIn ? undefined : "Like — you'll join as a guest"}
        onClick={async () => {
          const r = await like(target).catch(() => null);
          if (r) onLiked(r);
        }}
        className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors hover:bg-surface-3 disabled:opacity-60", liked && "text-danger")}
      >
        <Icon name="star" size={14} /> {likes}
      </button>
      {mine ? (
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("Remove this for good?")) return;
            await removeItem(target).then(onRemoved, (err) => setNote(err instanceof ClinicalEngineError ? err.message : "That didn't work."));
          }}
          className="rounded-full px-2.5 py-1 hover:bg-surface-3"
        >
          Remove
        </button>
      ) : (
        account && (
          <button
            type="button"
            onClick={async () => {
              await reportItem(target).then(
                () => setNote("Reported — thank you. We'll take a look."),
                (err) => setNote(err instanceof ClinicalEngineError ? err.message : "That didn't work."),
              );
            }}
            className="rounded-full px-2.5 py-1 hover:bg-surface-3"
          >
            Report
          </button>
        )
      )}
      {note && <span className="text-[12.5px] text-fg-3">{note}</span>}
    </div>
  );
}

export function PostView({ initial, signedIn, account }: { initial: Post; signedIn: boolean; account: boolean }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(!initial.spoiler);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { reply: r } = await newReply(post.id, reply.trim());
      setPost((p) => ({ ...p, replies: p.replies + 1, replyList: [...p.replyList, r] }));
      setReply("");
    } catch (err) {
      setError(err instanceof ClinicalEngineError ? err.message : "That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/community" className="flex items-center gap-1.5 self-start text-[13.5px] font-medium text-fg-2 hover:text-fg">
        <Icon name="arrow-left" size={14} /> Community
      </Link>
      <article className="panel p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <Byline author={post.author} at={post.createdAt} />
          <span className="shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-[11.5px] font-medium text-fg-2">{TOPICS[post.topic].label}</span>
        </div>
        <h1 className="mt-4 text-[22px] leading-snug font-semibold tracking-[-0.015em] sm:text-[26px]">{post.title}</h1>
        {open ? (
          <>
            <p className="mt-3 text-[15px] leading-7 whitespace-pre-wrap text-fg">{post.body}</p>
            {post.shareId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/share/${post.shareId}/card?f=square`} alt="The result card for this case" className="mt-4 w-full max-w-[360px] rounded-2xl" />
            )}
          </>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-warning bg-warning-soft px-4 py-6 text-[14px] font-medium text-warning">
            <Icon name="eye" size={16} /> Spoiler — tap to read
          </button>
        )}
        <Actions target={`p:${post.id}`} likes={post.likes} liked={post.liked} mine={post.mine} signedIn={signedIn} account={account} onLiked={(r) => setPost((p) => ({ ...p, ...r }))} onRemoved={() => router.push("/community")} />
      </article>

      <section aria-labelledby="replies-heading" className="flex flex-col gap-3">
        <h2 id="replies-heading" className="micro px-1 text-fg-2">
          {post.replyList.length} {post.replyList.length === 1 ? "reply" : "replies"}
        </h2>
        {post.replyList.map((r: Reply) => (
          <div key={r.id} className="card p-4 sm:p-5">
            <Byline author={r.author} at={r.createdAt} />
            <p className="mt-3 text-[14.5px] leading-7 whitespace-pre-wrap">{r.body}</p>
            <Actions
              target={`r:${r.id}`}
              likes={r.likes}
              liked={r.liked}
              mine={r.mine}
              signedIn={signedIn}
              account={account}
              onLiked={(x) => setPost((p) => ({ ...p, replyList: p.replyList.map((y) => (y.id === r.id ? { ...y, ...x } : y)) }))}
              onRemoved={() => setPost((p) => ({ ...p, replies: p.replies - 1, replyList: p.replyList.filter((y) => y.id !== r.id) }))}
            />
          </div>
        ))}

        {/* Open to everyone: a visitor's first reply makes them a guest. */}
        <form onSubmit={send} className="panel flex flex-col gap-3 p-4 sm:p-5">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 3000))}
            rows={3}
            placeholder="Add your reply — reasoning, a guideline, a question back…"
            className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-6 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || reply.trim().length < 2} className="bg-ai inline-flex h-10 items-center gap-2 self-end rounded-full px-5 text-[14px] font-semibold text-white shadow-glow disabled:opacity-60">
            {busy ? "Checking…" : "Reply"} {!busy && <Icon name="send" size={14} />}
          </button>
        </form>
      </section>
    </div>
  );
}
