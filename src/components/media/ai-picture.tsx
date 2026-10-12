"use client";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { MediaAsset, PictureType } from "@/engine/types";
import { caseSnapshot } from "@/lib/case-store";
import { cn } from "@/lib/cn";

/**
 * A picture the AI draws the moment the case reaches it. The page only knows
 * its reference; the server draws it from the case (and keeps it), so it
 * appears a little after the finding — the case carries on meanwhile.
 */
const WAITING: Record<PictureType, string> = {
  photo: "Taking the photograph…",
  xray: "Taking the X-ray…",
  ct: "Scanning…",
  mri: "Scanning…",
  usg: "Scanning…",
  fundus: "Photographing the fundus…",
  endoscopy: "Recording the endoscopy…",
  slide: "Preparing the slide…",
};

/** Pictures already fetched this visit, by session and reference (each asked for once). */
const pictures = new Map<string, Promise<string>>();

function fetchPicture(key: string, token: string, ref: string): Promise<string> {
  let p = pictures.get(key);
  if (!p) {
    p = fetch("/api/cases/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ref }) }).then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      return URL.createObjectURL(await res.blob());
    });
    p.catch(() => pictures.delete(key));
    pictures.set(key, p);
  }
  return p;
}

export function AiPicture({ media, className, large = false }: { media: MediaAsset; className?: string; large?: boolean }) {
  const ai = media.ai!;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const session = caseSnapshot().session;
    if (!session) return;
    let live = true;
    setFailed(false);
    fetchPicture(`${session.state.sessionId}:${ai.ref}`, session.token, ai.ref)
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [ai.ref, attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={media.alt} draggable={false} className={cn(large ? "block max-h-[78dvh] max-w-[92vw] object-contain" : "block h-auto w-full", className)} />;
  }
  return (
    <div className={cn("relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[#0b0d12] text-center text-white/80", large && "w-[min(78dvh,92vw)] rounded-md", className)} role="status" aria-live="polite">
      {!failed && <span aria-hidden className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_45%,rgb(255_255_255/0.08),transparent_60%)]" />}
      <Icon name={failed ? "alert" : "image"} size={22} className="relative text-white/60" />
      <span className="relative text-[13px] font-medium">{failed ? "Couldn't get this picture just now." : WAITING[ai.type]}</span>
      {failed ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            retry();
          }}
          className="relative rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white/20"
        >
          Try again
        </button>
      ) : (
        <span className="relative text-[11.5px] text-white/50">Usually ready in under half a minute — carry on meanwhile.</span>
      )}
    </div>
  );
}
