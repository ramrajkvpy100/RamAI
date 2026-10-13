"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

type Format = "story" | "square";
type Style = "collectible" | "monitor" | "badge";
export type ShareTarget = { kind: "result"; sessionId: string } | { kind: "progress" };

/** The card's three looks — each with the doctor's avatar. */
const STYLES: { id: Style; label: string; swatch: string }[] = [
  { id: "collectible", label: "Collectible", swatch: "linear-gradient(135deg, #fbbf24, #a78bfa 55%, #22d3ee)" },
  { id: "monitor", label: "Monitor", swatch: "linear-gradient(135deg, #010403, #052e16 60%, #22c55e)" },
  { id: "badge", label: "ID badge", swatch: "linear-gradient(135deg, #7c3aed, #2563eb 55%, #e2e8f0 56%)" },
];
const STYLE_KEY = "ramai.share-style";

interface Shared {
  url: string;
  images: Record<Format | "wide", string>;
}

const TEXT: Record<ShareTarget["kind"], string> = {
  result: "I just solved a clinical case on RamAI — can you beat my score?",
  progress: "My progress on RamAI — a new clinical case every day.",
};

/** Links that open a share box on each platform with the link filled in (Instagram has none — it takes the picture). */
const PLATFORMS = (text: string, url: string) => [
  { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, color: "#25d366" },
  { name: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, color: "#111" },
  { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, color: "#0a66c2" },
  { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, color: "#1877f2" },
  { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, color: "#229ed9" },
];

/** A picture of the result (or progress) to post — a Status or Story, or a square post — and a link that previews itself. */
export function ShareSheet({ open, onClose, target, title = "Share" }: { open: boolean; onClose: () => void; target: ShareTarget; title?: string }) {
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("story");
  const [style, setStyle] = useState<Style>(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      return saved === "monitor" || saved === "badge" ? saved : "collectible";
    } catch {
      return "collectible";
    }
  });
  const pickStyle = (s: Style) => {
    setStyle(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {}
  };
  /** The picture and the link, in the chosen look. */
  const imageOf = (f: Format) => (shared ? `${shared.images[f]}${style === "collectible" ? "" : `&s=${style}`}` : "");
  const link = shared ? `${shared.url}${style === "collectible" ? "" : `?s=${style}`}` : "";
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = target.kind === "result" ? target.sessionId : "progress";

  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(target) })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as (Shared & { error?: { message?: string } }) | null;
        if (!res.ok || !json?.url) throw new Error(json?.error?.message ?? "Sharing isn't available just now.");
        if (live) setShared(json);
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : "Sharing isn't available just now."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one share link per thing shared
  }, [open, key]);

  const text = TEXT[target.kind];
  const picture = async (): Promise<File> => {
    const res = await fetch(imageOf(format));
    if (!res.ok) throw new Error("The picture isn't ready yet.");
    return new File([await res.blob()], `ramai-${target.kind}-${style}-${format}.png`, { type: "image/png" });
  };
  const save = (file: File) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setNote("Saved — add it to your Status or Story.");
  };
  const sharePicture = async () => {
    if (!shared || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const file = await picture();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${link}` });
        setNote("Shared.");
      } else {
        save(file);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setNote(err instanceof Error ? err.message : "That didn't work — try Download.");
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    try {
      save(await picture());
    } catch {
      setNote("The picture isn't ready yet — try again in a moment.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setNote("Link copied.");
    } catch {
      setNote(link);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} placement="responsive">
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Card style" className="grid grid-cols-3 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                onClick={() => pickStyle(s.id)}
                className={cn("flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-[12.5px] font-medium transition-colors", style === s.id ? "border-accent-line bg-accent-soft text-fg" : "border-line bg-surface text-fg-2 hover:text-fg")}
              >
                <span aria-hidden className="h-9 w-full rounded-xl" style={{ background: s.swatch }} />
                {s.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Picture size" className="flex self-center rounded-full bg-surface-3 p-1">
            {(
              [
                ["story", "Status / Story"],
                ["square", "Post"],
              ] as const
            ).map(([f, label]) => (
              <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)} className={cn("h-8 rounded-full px-4 text-[13px] font-medium transition-colors", format === f ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            {shared ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${format}-${style}`}
                src={imageOf(format)}
                alt="Your card"
                className={cn("animate-fade rounded-2xl shadow-[0_20px_60px_-24px_rgb(0_0_0/0.6)]", format === "story" ? "aspect-[9/16] max-h-[46dvh] w-auto" : "aspect-square w-full max-w-[340px]")}
              />
            ) : (
              <div className={cn("animate-pulse rounded-2xl bg-surface-3", format === "story" ? "aspect-[9/16] h-[46dvh]" : "aspect-square w-full max-w-[340px]")} aria-label="Making your card" />
            )}
          </div>

          <button type="button" onClick={() => void sharePicture()} disabled={!shared || busy} className="shine flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-glow disabled:opacity-60">
            <Icon name="share-ios" size={17} /> {busy ? "Opening…" : "Share picture"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void download()} disabled={!shared} className="flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-[14px] font-medium hover:bg-surface-2 disabled:opacity-60">
              <Icon name="image" size={15} /> Download
            </button>
            <button type="button" onClick={() => void copy()} disabled={!shared} className="flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface text-[14px] font-medium hover:bg-surface-2 disabled:opacity-60">
              <Icon name="file" size={15} /> Copy link
            </button>
          </div>
          {shared && (
            <div className="flex flex-wrap justify-center gap-2" aria-label="Share the link on">
              {PLATFORMS(text, link).map((p) => (
                <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-medium hover:bg-surface-3">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </a>
              ))}
            </div>
          )}
          <p className="text-center text-[12px] leading-5 text-fg-3" aria-live="polite">
            {note ?? "For Instagram, use Share picture on your phone — or Download and add it to your Story."}
          </p>
        </div>
      )}
    </Sheet>
  );
}
