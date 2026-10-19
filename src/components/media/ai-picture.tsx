"use client";

import { useCallback, useEffect, useState } from "react";

import { ScanAnimation } from "./scan-animation";
import { Icon } from "@/components/ui/icon";
import type { MediaAsset, PictureType } from "@/engine/types";
import { caseSnapshot } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { isLowData } from "@/lib/low-data";

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

interface Fetched {
  url: string;
  /** Drawn by AI — or a real image, with whom to credit. */
  credit: { author: string; license: string; source: string } | null;
}

/** Pictures already fetched this visit, by session and reference (each asked for once). */
const pictures = new Map<string, Promise<Fetched>>();

export function fetchPicture(key: string, token: string, ref: string): Promise<Fetched> {
  let p = pictures.get(key);
  if (!p) {
    p = fetch("/api/cases/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ref }) }).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 503 ? "off" : String(res.status));
      let credit: Fetched["credit"] = null;
      try {
        const raw = res.headers.get("X-Picture-Credit");
        if (raw) credit = JSON.parse(decodeURIComponent(raw)) as Fetched["credit"];
      } catch {
        credit = null;
      }
      return { url: URL.createObjectURL(await res.blob()), credit };
    });
    p.catch(() => pictures.delete(key));
    pictures.set(key, p);
  }
  return p;
}

/** Who made the picture: "AI-generated", or a real image's author and licence. */
function Credit({ credit, large }: { credit: Fetched["credit"]; large: boolean }) {
  return (
    <span className={cn("block px-2 py-1 text-[10.5px] leading-4", large ? "text-white/60" : "bg-black text-white/55")}>
      {credit ? (
        <>
          Real image · {credit.author} ·{" "}
          {/* Inside a figure's open-full-size button a link isn't allowed: the full-size view carries it. */}
          {large ? (
            <a href={credit.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              {credit.license}, Wikimedia Commons
            </a>
          ) : (
            `${credit.license}, Wikimedia Commons`
          )}
        </>
      ) : (
        "AI-generated image"
      )}
    </span>
  );
}

export function AiPicture({ media, className, large = false, fallback }: { media: MediaAsset; className?: string; large?: boolean; /** Shown instead when the picture can't be made (a drawn spec). */ fallback?: React.ReactNode }) {
  const ai = media.ai!;
  const [got, setGot] = useState<Fetched | null>(null);
  const [failed, setFailed] = useState(false);
  /** No image model here at all (a local copy): the drawn stand-in, if there is one. */
  const [off, setOff] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Low-data mode: nothing is fetched until the doctor asks for it. */
  const [held, setHeld] = useState(false);
  useEffect(() => setHeld(isLowData()), []);

  useEffect(() => {
    if (held) return;
    const session = caseSnapshot().session;
    if (!session) return;
    let live = true;
    setFailed(false);
    fetchPicture(`${session.state.sessionId}:${ai.ref}`, session.token, ai.ref)
      .then((u) => live && setGot(u))
      .catch((err) => {
        if (!live) return;
        // One quiet retry before asking the doctor: a slow first try is often fine the second time.
        if (attempt === 0 && !(err instanceof Error && err.message === "off")) {
          setAttempt(1);
          return;
        }
        setFailed(true);
        setOff(err instanceof Error && err.message === "off");
      });
    return () => {
      live = false;
    };
  }, [ai.ref, attempt, held]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  if (got) {
    return (
      <span className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={got.url} alt={media.alt} draggable={false} className={cn(large ? "block max-h-[74dvh] max-w-[92vw] object-contain" : "block h-auto w-full", className)} />
        <Credit credit={got.credit} large={large} />
      </span>
    );
  }
  if (off && fallback) return <>{fallback}</>;
  if (held)
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setHeld(false); }} className={cn("flex aspect-square w-full flex-col items-center justify-center gap-2 bg-[#0b0d12] text-[13px] font-medium text-white/80", className)}>
        <Icon name="image" size={20} className="text-white/60" /> Tap to load the picture
      </button>
    );
  return (
    <div className={cn("relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[#0b0d12] text-center text-white/80", large && "w-[min(78dvh,92vw)] rounded-md", className)} role="status" aria-live="polite">
      {failed ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
          <Icon name="alert" size={20} className="text-white/80" />
        </span>
      ) : (
        <ScanAnimation type={ai.type} />
      )}
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
        <>
          <span className="relative flex items-center gap-1.5 text-[11.5px] text-white/50">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
            Takes a moment — carry on with the case meanwhile.
          </span>
        </>
      )}
    </div>
  );
}
