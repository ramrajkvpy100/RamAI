"use client";

import { useCallback, useEffect, useState } from "react";

import { FillingBar } from "@/components/ui/filling-bar";
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

  useEffect(() => {
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
  }, [ai.ref, attempt]);
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
  return (
    <div className={cn("relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[#0b0d12] text-center text-white/80", large && "w-[min(78dvh,92vw)] rounded-md", className)} role="status" aria-live="polite">
      {!failed && (
        <>
          <span aria-hidden className="scan-anim absolute -inset-1/4 bg-[radial-gradient(circle_at_35%_40%,rgb(56_189_248/0.22),transparent_45%),radial-gradient(circle_at_65%_60%,rgb(167_139_250/0.2),transparent_45%)]" style={{ animation: "scan-glow 6s ease-in-out infinite" }} />
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:24px_24px]" />
          <span aria-hidden className="scan-anim absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-sky-300/25 to-transparent shadow-[0_0_24px_rgb(125_211_252/0.35)]" style={{ animation: "scan-beam 2.4s cubic-bezier(.45,0,.55,1) infinite" }} />
        </>
      )}
      <span className="relative flex h-14 w-14 items-center justify-center">
        {!failed && <span aria-hidden className="scan-anim absolute inset-0 rounded-full border border-sky-300/50" style={{ animation: "scan-ring 1.8s ease-out infinite" }} />}
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur">
          <Icon name={failed ? "alert" : "image"} size={20} className="text-white/80" />
        </span>
      </span>
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
          <span className="relative text-[11.5px] text-white/50">Usually ready in under half a minute — carry on meanwhile.</span>
          <FillingBar active expectedMs={14_000} tone="light" label="Preparing the picture" className="relative mt-1 w-2/3 max-w-[220px]" />
        </>
      )}
    </div>
  );
}
