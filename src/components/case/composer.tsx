"use client";

import { tap } from "@/lib/haptics";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { Country } from "@/engine/countries";
import { menusFor, QUICK_ACTIONS } from "@/lib/tool-menus";
import { useSpeech } from "@/lib/use-speech";
import { useLiveTalk } from "@/lib/use-live-talk";

import { useComposer } from "./composer-context";
import { ToolMenu } from "./tool-menu";

/** Beginner (suggestions and timed hints) or Expert (nothing offered) — the doctor's choice, remembered on this device. */
/** One way to play for everyone now (the Beginner/Expert switch is gone): the senior is always in reach. */
export function useExpert(): { on: boolean; toggle: () => void } {
  return { on: false, toggle: () => undefined };
}

export function Composer({
  onSend,
  disabled,
  sending,
  history,
  phone = false,
  country,
  watch,
  skin = false,
}: {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
  sending?: boolean;
  /** Previous doctor inputs, newest last — ↑ recalls them. */
  history: string[];
  /** Phone consult: no examination or tests, so only history and advice shortcuts. */
  phone?: boolean;
  /** Shortcuts use the test and drug names of the country the case is set in. */
  country?: Country;
  /** A treatment still acting: one tap waits for its full effect, and what changed is reported. */
  watch?: { label: string; minutes: number } | null;
  /** A skin complaint: one tap shows the rash or lesion. */
  skin?: boolean;
}) {
  const { draft, setDraft, insert, inputRef } = useComposer();
  const [menu, setMenu] = useState<string | null>(null);
  const recall = useRef<number>(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const base = useRef("");
  const talk = useLiveTalk(onSend, !!sending);
  const speech = useSpeech((text) => setDraft(base.current ? `${base.current} ${text}` : text));
  const actions = QUICK_ACTIONS.filter((a) => a.id !== "monitoring" && (!phone || a.id === "history" || a.id === "treatment"));
  const monitorAction = phone ? undefined : QUICK_ACTIONS.find((a) => a.id === "monitoring");
  const expert = useExpert();

  // Grow with content, up to ~6 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft, inputRef]);

  // "/" anywhere on the case screen jumps to the order box (as in an EMR).
  useEffect(() => {
    const onSlash = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, [inputRef]);

  // Close the quick-action menu on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || disabled || sending) return;
    if (speech.listening) speech.stop();
    setDraft("");
    setMenu(null);
    recall.current = -1;
    const ok = await onSend(text);
    if (!ok) setDraft(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "ArrowUp" && !draft && history.length) {
      e.preventDefault();
      recall.current = recall.current < 0 ? history.length - 1 : Math.max(0, recall.current - 1);
      setDraft(history[recall.current] ?? "");
    }
  };

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    base.current = draft.trim();
    speech.start();
    inputRef.current?.focus();
  };

  const active = QUICK_ACTIONS.find((a) => a.id === menu && (a.id !== "monitoring" || !!monitorAction));
  const categories = active ? menusFor(country).filter((c) => active.categories.includes(c.id)) : [];


  return (
    <div className="relative" ref={menuRef}>
      {menu === "more" && (
        <div className="popover absolute right-0 bottom-full left-0 z-20 mb-2 animate-enter rounded-2xl p-3" role="dialog" aria-label="More">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {monitorAction && (
              <button type="button" onClick={() => setMenu(monitorAction.id)} className="h-11 rounded-xl border border-line bg-surface text-[13.5px] font-medium hover:bg-surface-2">📈 Monitor</button>
            )}
            <button type="button" disabled={disabled || sending} onClick={() => { setMenu(null); void onSend("Opinion"); }} className="h-11 rounded-xl border border-line bg-surface text-[13.5px] font-medium hover:bg-surface-2 disabled:opacity-50">🩺 Opinion</button>
            {!expert.on && (
              <button type="button" disabled={disabled || sending} onClick={() => { setMenu(null); void onSend("Hint"); }} className="h-11 rounded-xl border border-amber-300/60 bg-amber-50 text-[13.5px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">👩‍⚕️ Ask senior</button>
            )}
            {!phone && (
              <button type="button" disabled={disabled || sending} onClick={() => { setMenu(null); void onSend("Order CBC, RFT, LFT, electrolytes and ECG"); }} className="h-11 rounded-xl border border-line bg-surface text-[13.5px] font-medium hover:bg-surface-2 disabled:opacity-50" title="CBC, RFT, LFT, electrolytes and ECG in one tap">🧪 Basic panel</button>
            )}
          </div>
        </div>
      )}
      {active && (
        <div className="popover absolute right-0 bottom-full left-0 z-20 mb-2 animate-enter rounded-2xl p-3.5" role="dialog" aria-label={`${active.label} shortcuts`}>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="micro text-fg-2">{active.label}</div>
            <IconButton label="Close shortcuts" size="sm" onClick={() => setMenu(null)} className="-mt-1 -mr-1.5">
              <Icon name="x" size={14} />
            </IconButton>
          </div>
          <div className="flex max-h-[42dvh] flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
            {categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-2">
                {categories.length > 1 && <div className="text-[12px] font-semibold text-fg">{category.label}</div>}
                <ToolMenu
                  category={category}
                  dense
                  onPick={(item) => {
                    insert(item);
                    if (item.mode !== "order") setMenu(null);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The three things most needed, big and plain. */}
      {!phone && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {!expert.on && (
            <button type="button" disabled={disabled || sending} onClick={() => { tap(); void onSend("Hint"); }} data-coach-target="senior" className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50", "border border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100")}>
              👩‍⚕️ <span className="truncate">Ask senior</span>
            </button>
          )}
          <button type="button" disabled={disabled || sending} onClick={() => { tap(); void onSend("Take full history"); }} className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50", "border border-line bg-surface text-fg")}>
            📋 <span className="truncate">Full history</span>
          </button>
          {skin ? (
            <button type="button" disabled={disabled || sending} onClick={() => { tap(); void onSend("Examine the skin lesion"); }} className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50", "border border-accent-line bg-accent-soft text-accent-text")}>
              📷 <span className="truncate">Show rash</span>
            </button>
          ) : talk.supported ? (
            <button type="button" onClick={() => { tap(); talk.toggle(); }} aria-pressed={talk.on} className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50", talk.on ? "pulse-ring bg-success text-white" : "border border-line bg-surface text-fg")}>
              {talk.on ? "● Live" : "🎙 Talk live"}
            </button>
          ) : (
            <button type="button" onClick={() => setMenu((m) => (m === "more" ? null : "more"))} className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold transition-transform active:scale-95 disabled:opacity-50", "border border-line bg-surface text-fg")}>
              ＋ More
            </button>
          )}
        </div>
      )}

      <div
        data-coach-target="composer"
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border bg-surface p-1.5 shadow-sm transition-[border-color,box-shadow] duration-150",
          speech.listening ? "border-danger shadow-[0_0_0_3px_var(--danger-soft)]" : "border-line focus-within:border-accent-line focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
        )}
      >
        <label htmlFor="composer" className="sr-only">Your next question or order</label>
        <textarea
          id="composer"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={speech.listening ? "Listening… speak your question or order" : phone ? "Type to the caller — e.g. What happened?" : "Ask, examine, order or treat…"}
          className="block max-h-[168px] min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] leading-6 text-fg outline-none placeholder:text-fg-3 disabled:opacity-60"
          autoComplete="off"
          spellCheck
          enterKeyHint="send"
        />
        {speech.supported && (
          <IconButton
            label={speech.listening ? "Stop voice input" : "Speak instead of typing"}
            size="sm"
            onClick={toggleMic}
            className={cn("mb-1 rounded-full", speech.listening ? "pulse-ring bg-danger text-white hover:bg-danger hover:text-white" : "text-fg-2")}
          >
            <Icon name="mic" size={17} />
          </IconButton>
        )}
        <IconButton label="Send" variant="primary" size="sm" onClick={() => void submit()} disabled={!draft.trim() || disabled || sending} className="mb-1 rounded-full">
          <Icon name="arrow-up" size={16} strokeWidth={2.2} />
        </IconButton>
      </div>

      {/* Everything else: one short row of tools. */}
      <div className="mt-1.5 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {watch && (
          <button type="button" disabled={disabled || sending} onClick={() => void onSend(`Wait ${watch.minutes} minutes`)} className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150", "animate-enter bg-accent font-semibold text-on-accent disabled:opacity-60")}>
            Skip {watch.minutes} min ››
          </button>
        )}
        {actions.map((a) => (
          <button key={a.id} type="button" aria-expanded={menu === a.id} aria-haspopup="dialog" onClick={() => setMenu((m) => (m === a.id ? null : a.id))} className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150", menu === a.id ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
            {a.label}
          </button>
        ))}
        <button type="button" aria-expanded={menu === "more"} onClick={() => setMenu((m) => (m === "more" ? null : "more"))} className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150", menu === "more" ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
          More ▾
        </button>
        {skin && talk.supported && !phone && (
          <button type="button" onClick={() => { tap(); talk.toggle(); }} aria-pressed={talk.on} className={cn("h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-150", "ml-auto", talk.on ? "pulse-ring bg-success text-white" : "text-fg-2 hover:bg-surface-3")}>
            {talk.on ? "● Live" : "🎙 Live"}
          </button>
        )}
      </div>
      {talk.on && (
        <p role="status" className="mt-1.5 animate-enter px-2 text-[12.5px] text-success">
          {sending ? "The patient is answering…" : talk.heard ? `“${talk.heard}”` : "Listening — just talk to the patient. Tap ● Live to stop."}
        </p>
      )}
      {speech.error && (
        <p role="status" className="mt-1.5 px-2 text-[12px] text-danger">
          {speech.error}
        </p>
      )}
    </div>
  );
}
