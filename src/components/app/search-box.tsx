"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/cn";

interface Item { t: string; s: string; h: string; k?: string }

let index: Item[] | null = null;
let loading: Promise<Item[]> | null = null;
/** Fetched once (cached by the browser too), then every keystroke is filtered here — instant. */
const load = () => (index ? Promise.resolve(index) : (loading ??= fetch("/api/search").then((r) => r.json() as Promise<Item[]>).then((x) => (index = x)).catch(() => (loading = null, []))));

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

function rank(items: Item[], q: string): Item[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: [number, Item][] = [];
  for (const it of items) {
    const title = norm(it.t), all = `${title} ${norm(it.s)} ${norm(it.k ?? "")}`;
    if (!words.every((w) => all.includes(w))) continue;
    let score = 0;
    for (const w of words) score += title.startsWith(w) ? 6 : new RegExp(`\\b${w}`).test(title) ? 4 : title.includes(w) ? 2 : 1;
    if (it.s === "Cases" || it.s === "Practice" || it.s === "Skills Lab") score += 1;
    scored.push([score - title.length / 200, it]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 30).map(([, it]) => it);
}

/** One search box for all of RamAI: pages, drills, diagnoses, antidotes, algorithms, exams and help. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <>
      <button type="button" onPointerEnter={() => void load()} onFocus={() => void load()} onClick={() => { void load(); setOpen(true); }} aria-label="Search RamAI" title="Search (⌘K)" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      {open && <SearchSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>(index ?? []);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void load().then(setItems);
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const found = useMemo(() => rank(items, q), [items, q]);
  useEffect(() => setSel(0), [q]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[90] flex flex-col bg-black/40 backdrop-blur-sm sm:items-center sm:pt-[12vh]" onClick={onClose}>
        <div role="dialog" aria-label="Search" className="flex max-h-full w-full flex-col overflow-hidden bg-surface sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 border-b border-line px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-fg-3" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(found.length - 1, s + 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                if (e.key === "Enter" && found[sel]) { window.location.assign(found[sel].h); onClose(); }
              }}
              placeholder="Search diagnoses, drills, exams, anything…"
              aria-label="Search"
              enterKeyHint="go"
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-fg-3"
            />
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[14px] font-medium text-fg-2 hover:bg-surface-3">Cancel</button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Results">
            {q.trim() && !found.length && <li className="px-4 py-6 text-center text-[14px] text-fg-3">Nothing found for “{q}”.</li>}
            {found.map((it, i) => (
              <li key={`${it.h}|${it.t}`} role="option" aria-selected={i === sel}>
                <Link href={it.h} onClick={onClose} className={cn("flex flex-col px-4 py-2.5", i === sel ? "bg-surface-3" : "hover:bg-surface-2")}>
                  <span className="truncate text-[14.5px] text-fg">{it.t}</span>
                  <span className="truncate text-[12px] text-fg-3">{it.s}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Portal>
  );
}
