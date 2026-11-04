"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/cn";
import { getPrefs, setPrefs, SIZES, start, todayMinutes, todaySessions, useFocus, type Drink, type Size } from "@/lib/focus";
import { success, tap } from "@/lib/haptics";

import { Cup, DRINKS } from "./cup";
import { lockScreen } from "./settle";

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
/** The cups on the menu; a grove session has its own screen. */
const CUP_SIZES = (Object.keys(SIZES) as Size[]).filter((s) => s !== "grove");

export type FocusMode = "grove" | "cafe";

/** The two ways to focus. The choice is remembered on this device. */
export function FocusModeToggle({ mode, onChange }: { mode: FocusMode; onChange: (m: FocusMode) => void }) {
  const choose = (m: FocusMode) => {
    tap();
    setPrefs({ mode: m });
    onChange(m);
  };
  const item = (m: FocusMode, label: string) => (
    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => choose(m)} className={cn("flex-1 rounded-full px-3 py-1.5 text-[14px] font-medium transition-colors", mode === m ? "bg-[#3f7d63] text-white shadow-sm" : "text-current opacity-75")}>
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Focus style" className="mx-auto flex w-full max-w-[300px] gap-1 rounded-full bg-black/[0.06] p-1 dark:bg-white/10">
      {item("grove", "🌿 Clinical Grove")}
      {item("cafe", "☕ Café")}
    </div>
  );
}

/** Paper card on a wooden café table. */
function Table({ children }: { children: React.ReactNode }) {
  return (
    <Portal>
      <div className="focus-table fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto p-4">
        <div className="focus-paper relative w-full max-w-xl animate-pop px-6 py-9 text-[#24332c] sm:px-10">
          <Link href="/" aria-label="Back to RamAI" className="absolute top-4 left-4 text-[14px] font-medium text-[#56655d]">← Home</Link>
          {children}
        </div>
      </div>
    </Portal>
  );
}

/** A café pomodoro. Order a drink, pick a size, say what you'll do — then sit and work while it empties. */
export function CafeOrder({ onMode }: { onMode: (m: FocusMode) => void }) {
  const { done } = useFocus();
  const [step, setStep] = useState<"drink" | "size" | "note">("drink");
  const [drink, setDrink] = useState<Drink | null>(null);
  const [size, setSize] = useState<Size>("tall");
  const [note, setNote] = useState("");

  useEffect(() => {
    const p = getPrefs();
    if (p.drink) setDrink(p.drink);
    if (p.size && p.size !== "grove") setSize(p.size);
  }, []);

  if (step === "drink")
    return (
      <Table>
        <div className="mt-5"><FocusModeToggle mode="cafe" onChange={onMode} /></div>
        <p className="mt-5 text-center text-[13px] font-semibold tracking-[0.18em] text-[#3f7d63] uppercase">Focus</p>
        <p className="mt-1 text-center text-[22px] font-medium">What are you sipping today?</p>
        <div className="mt-7 grid grid-cols-3 gap-x-3 gap-y-6">
          {(Object.keys(DRINKS) as Drink[]).map((d) => (
            <button key={d} type="button" onClick={() => { tap(); setDrink(d); }} aria-pressed={drink === d} className={cn("flex flex-col items-center gap-2 rounded-2xl p-2 transition-transform active:scale-95", drink === d && "bg-white shadow-md ring-2 ring-[#3f7d63]")}>
              <Cup drink={d} size={86} />
              <span className="text-[14px]">{DRINKS[d].label}</span>
            </button>
          ))}
        </div>
        <button type="button" disabled={!drink} onClick={() => { tap(); setStep("size"); }} className="focus-btn mx-auto mt-8 block disabled:bg-[#c9d3cd] disabled:text-[#56655d] disabled:shadow-none">
          {drink ? "next" : "choose a drink first"}
        </button>
        <TodayLine minutes={todayMinutes(done)} sessions={todaySessions(done).length} />
      </Table>
    );
  if (step === "size")
    return (
      <Table>
        <div className="flex justify-center"><Cup drink={drink!} size={96} steam /></div>
        <div role="radiogroup" aria-label="Size" className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
          {CUP_SIZES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { tap(); setSize(s); }} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors", size === s ? "bg-white shadow-sm ring-2 ring-[#3f7d63]" : "bg-white/40 hover:bg-white/70")}>
              <span className="text-[17px]">{SIZES[s].label}</span>
              <span className="mx-1 h-px flex-1 border-t border-dotted border-[#24332c60]" />
              <span className="text-right text-[13.5px] text-[#56655d]">{SIZES[s].note}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { tap(); setStep("note"); }} className="focus-btn mx-auto mt-7 block">next</button>
        <button type="button" onClick={() => setStep("drink")} className="mx-auto mt-3 block text-[14px] text-[#56655d] underline">← back</button>
      </Table>
    );
  return (
    <Table>
      <div className="mx-auto max-w-sm -rotate-1 bg-[#fff6c2] px-6 py-8 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)]">
        <p className="text-center text-[13px] tracking-[0.14em] text-[#56655d] uppercase">I will…</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} rows={3} placeholder="revise antibiotics…" className="focus-hand mt-3 w-full resize-none bg-transparent text-center text-[26px] leading-tight text-[#2a2621] outline-none placeholder:text-[#8a857c]" autoFocus />
      </div>
      <button type="button" onClick={() => { tap(); success(); start(drink!, size, note); if (SIZES[size].focus) void lockScreen(`Focusing${note ? `: ${note}` : ""}`, `Until ${clock(Date.now() + SIZES[size].focus * 60_000)}`); }} className="focus-btn mx-auto mt-7 block">start</button>
      <button type="button" onClick={() => setStep("size")} className="mx-auto mt-3 block text-[14px] text-[#56655d] underline">← back</button>
    </Table>
  );
}

function TodayLine({ minutes, sessions }: { minutes: number; sessions: number }) {
  return <p className="mt-6 text-center text-[13px] text-[#56655d]">{minutes ? `Today: ${minutes} min focused · ${sessions} session${sessions === 1 ? "" : "s"}` : "Kept on this phone. Breaks don't count — only focus."}</p>;
}
