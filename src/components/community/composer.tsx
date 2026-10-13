"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { TOPIC_IDS, TOPICS, type Topic } from "@/lib/community";
import { cn } from "@/lib/cn";
import { ClinicalEngineError } from "@/lib/engine-client";

import { newPost } from "./community-client";

export interface Draft {
  topic?: Topic;
  title?: string;
  body?: string;
  shareId?: string | null;
  spoiler?: boolean;
}

/** Writing a post. Read by the model before it appears; a shared case comes with its result card. */
export function Composer({ open, onClose, draft }: { open: boolean; onClose: () => void; draft?: Draft }) {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic>(draft?.topic ?? "questions");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [spoiler, setSpoiler] = useState(!!draft?.spoiler);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await newPost({ topic, title: title.trim(), body: body.trim(), shareId: draft?.shareId ?? null, spoiler });
      onClose();
      router.push(`/community/${id}`);
    } catch (err) {
      setError(err instanceof ClinicalEngineError ? err.message : "That didn't post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="New post" placement="responsive">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-1.5">
          {TOPIC_IDS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={topic === t}
              onClick={() => setTopic(t)}
              className={cn("h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors", topic === t ? "bg-fg text-bg" : "bg-surface-2 text-fg-2 hover:text-fg")}
            >
              {TOPICS[t].label}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 140))}
          placeholder="A clear title — e.g. 'When do you repeat troponin?'"
          required
          minLength={6}
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] font-medium shadow-sm outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 5000))}
          rows={6}
          required
          minLength={10}
          placeholder="Share the case, your reasoning or your question. Keep real patients anonymous."
          className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-6 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
        {draft?.shareId && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-fg-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/share/${draft.shareId}/card?f=square`} alt="" className="h-12 w-12 rounded-lg" />
            Your result card is attached.
          </div>
        )}
        <label className="flex items-center gap-2.5 text-[13px] text-fg-2">
          <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Contains spoilers (e.g. today&apos;s daily case) — blurred until opened
        </label>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || title.trim().length < 6 || body.trim().length < 10} className="shine flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-glow disabled:opacity-60">
          {busy ? "Checking and posting…" : "Post"} {!busy && <Icon name="send" size={15} />}
        </button>
        <p className="text-center text-[11.5px] leading-5 text-fg-3">Posts are checked by AI for abuse, spam and patient details before they appear.</p>
      </form>
    </Sheet>
  );
}
