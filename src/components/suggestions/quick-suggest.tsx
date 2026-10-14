"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { ClinicalEngineError } from "@/lib/engine-client";
import { CATEGORY_LABEL, sendSuggestion, type SuggestionCategory } from "@/lib/suggestions-client";

/**
 * A suggestion in two taps, from any page: a small button in the corner opens a box — pick what it is,
 * write it, send. It goes straight to RamAI's owner (email and phone), with the page it came from.
 */
export function QuickSuggest() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SuggestionCategory>("idea");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  // Cases, the admin pages and the suggestions page itself have their own space.
  if (path.startsWith("/case") || path.startsWith("/admin") || path.startsWith("/suggestions")) return null;

  const send = async () => {
    if (message.trim().length < 10) return setError("Please write at least 10 characters.");
    setState("sending");
    setError(null);
    try {
      await sendSuggestion({ category, message: message.trim(), page: path });
      setState("sent");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1800);
    } catch (err) {
      setState("idle");
      setError(err instanceof ClinicalEngineError ? err.message : "That didn't send. Please try again.");
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open && (
        <div role="dialog" aria-label="Suggest an improvement" className="popover w-[min(92vw,360px)] animate-enter rounded-2xl p-4">
          {state === "sent" ? (
            <p className="flex items-center gap-2 py-6 text-center text-[14.5px] font-semibold text-success">
              <Icon name="check" size={18} /> Thank you — it&apos;s on its way to the RamAI team.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[14.5px] font-semibold">Suggest an improvement</span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-fg-2 hover:bg-surface-3">
                  <Icon name="x" size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(CATEGORY_LABEL) as SuggestionCategory[]).map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium", category === c ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:text-fg")}>
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <textarea
                ref={box}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                }}
                rows={4}
                maxLength={2000}
                placeholder="What would make RamAI better?"
                className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] leading-6 outline-none focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              />
              {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
              <button type="button" onClick={() => void send()} disabled={state === "sending"} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60">
                {state === "sending" ? "Sending…" : "Send"} <Icon name="send" size={14} />
              </button>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-full bg-fg px-4 text-[13.5px] font-semibold text-bg shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)] transition-transform hover:scale-[1.03] active:scale-95"
      >
        <Icon name="bulb" size={16} /> Suggest
      </button>
    </div>
  );
}
