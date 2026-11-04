"use client";

import { useEffect, useState } from "react";

import { Mascot, MedicalIcon } from "@/components/ui/medical-icons";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { MNEMONICS, phraseParts, type MnemonicCard, type MnemonicDiagram } from "@/lib/tools/mnemonics";

import { AiNote, generate, Search, ToolHeader } from "./tool-parts";

const SAVED = "ramai.mnemonics.saved";
const readSaved = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** The drawn diagrams, for lists that have a real shape. Labels are in the same order as the letters. */
function Diagram({ kind }: { kind: MnemonicDiagram }) {
  const label = { fontSize: 9, fontWeight: 700, textAnchor: "middle" as const, fill: "#1f2d3d" };
  if (kind === "carpal") {
    // Right hand, palm up: thumb side on the left. Proximal row below, distal row above.
    const bone = (x: number, y: number, w: number, h: number, t: string, fill: string) => (
      <g key={t}>
        <rect x={x} y={y} width={w} height={h} rx="9" fill={fill} stroke="#7a6a4d" strokeWidth="1" />
        <text x={x + w / 2} y={y + h / 2 + 3} {...label}>{t}</text>
      </g>
    );
    return (
      <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="The two rows of carpal bones of the right hand, palm up">
        <rect width="240" height="150" fill="#f7f3ea" rx="10" />
        <text x="12" y="16" fontSize="8.5" fill="#6b5a3e" fontWeight="700">DISTAL ROW</text>
        {bone(10, 22, 56, 40, "Trapezium", "#f6d9a8")}
        {bone(68, 24, 54, 38, "Trapezoid", "#f6d9a8")}
        {bone(124, 18, 50, 50, "Capitate", "#f6d9a8")}
        {bone(176, 22, 52, 44, "Hamate", "#f6d9a8")}
        <text x="12" y="146" fontSize="8.5" fill="#6b5a3e" fontWeight="700">PROXIMAL ROW</text>
        {bone(12, 76, 56, 42, "Scaphoid", "#bfe0f5")}
        {bone(70, 78, 48, 40, "Lunate", "#bfe0f5")}
        {bone(120, 76, 60, 42, "Triquetrum", "#bfe0f5")}
        {bone(182, 90, 48, 34, "Pisiform", "#bfe0f5")}
      </svg>
    );
  }
  if (kind === "cuff") {
    return (
      <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="The four rotator cuff muscles around the humeral head">
        <rect width="240" height="150" fill="#f4f7fb" rx="10" />
        <circle cx="120" cy="78" r="30" fill="#f2ead8" stroke="#a5946f" strokeWidth="1.500" />
        <text x="120" y="82" {...label}>Humeral head</text>
        <path d="M92 58C78 38 58 30 34 30" stroke="#e8605c" strokeWidth="8" fill="none" strokeLinecap="round" /><text x="54" y="20" {...label}>Supraspinatus (top)</text>
        <path d="M148 62C170 48 188 44 212 48" stroke="#3b82f6" strokeWidth="8" fill="none" strokeLinecap="round" /><text x="186" y="36" {...label}>Infraspinatus (back)</text>
        <path d="M148 94C170 104 190 108 212 106" stroke="#16a34a" strokeWidth="8" fill="none" strokeLinecap="round" /><text x="186" y="124" {...label}>Teres minor (back)</text>
        <path d="M92 98C74 110 54 116 32 116" stroke="#a855f7" strokeWidth="8" fill="none" strokeLinecap="round" /><text x="56" y="134" {...label}>Subscapularis (front)</text>
      </svg>
    );
  }
  if (kind === "plexus") {
    const cols = [["Roots", "C5–T1", "#3b82f6"], ["Trunks", "3", "#16a34a"], ["Divisions", "6", "#f59e0b"], ["Cords", "3", "#ef4444"], ["Branches", "5", "#a855f7"]] as const;
    return (
      <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="The brachial plexus from roots to branches">
        <rect width="240" height="150" fill="#f4f7fb" rx="10" />
        {cols.map(([t, n, c], i) => (
          <g key={t}>
            {i < 4 && <path d={`M${36 + i * 44} 75H${58 + i * 44}`} stroke="#8fa3b8" strokeWidth="3" />}
            <circle cx={24 + i * 44 + 2} cy="75" r="17" fill={c} />
            <text x={26 + i * 44} y="79" fontSize="10" fontWeight="800" fill="#fff" textAnchor="middle">{t[0]}</text>
            <text x={26 + i * 44} y="108" {...label}>{t}</text>
            <text x={26 + i * 44} y="120" fontSize="8.5" fill="#566575" textAnchor="middle">{n}</text>
          </g>
        ))}
      </svg>
    );
  }
  if (kind === "tof") {
    return (
      <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="Schematic heart with the four features of tetralogy of Fallot">
        <rect width="240" height="150" fill="#fff5f5" rx="10" />
        <path d="M120 140c-34-24-62-46-64-76-2-22 12-40 32-40 14 0 26 8 32 18 6-10 18-18 32-18 20 0 34 18 32 40-2 30-30 52-64 76z" fill="#f7b3b3" stroke="#c94f4f" strokeWidth="1.500" />
        <path d="M122 66v50" stroke="#fff" strokeWidth="6" strokeDasharray="14 12" />
        <path d="M114 44V16h16v28" fill="#d94a4a" />
        <path d="M92 50V22" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" />
        <text x="58" y="14" {...label}>Pulmonary stenosis</text>
        <text x="178" y="14" {...label}>Overriding aorta</text>
        <path d="M86 18l-4 6" stroke="#1f2d3d" /><path d="M130 22l18-6" stroke="#1f2d3d" />
        <text x="122" y="90" {...label}>VSD</text>
        <text x="84" y="104" {...label}>RVH</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="An eye with a drooping upper lid and a small pupil beside a normal eye">
      <rect width="240" height="150" fill="#eefafb" rx="10" />
      {[{ x: 70, pupil: 5, t: "Ptosis and miosis", lid: 62 }, { x: 170, pupil: 11, t: "Normal side", lid: 50 }].map((e) => (
        <g key={e.x}>
          <ellipse cx={e.x} cy="74" rx="36" ry="24" fill="#fff" stroke="#0f7a84" strokeWidth="1.500" />
          <circle cx={e.x} cy="74" r="15" fill="#3aa8b3" /><circle cx={e.x} cy="74" r={e.pupil} fill="#08272d" />
          <path d={`M${e.x - 36} 74C${e.x - 22} ${e.lid - 6} ${e.x + 22} ${e.lid - 6} ${e.x + 36} 74L${e.x + 36} 40H${e.x - 36}z`} fill="#eefafb" />
          <path d={`M${e.x - 36} 74C${e.x - 22} ${e.lid - 6} ${e.x + 22} ${e.lid - 6} ${e.x + 36} 74`} fill="none" stroke="#0f7a84" strokeWidth="2.500" />
          <text x={e.x} y="118" {...label}>{e.t}</text>
        </g>
      ))}
    </svg>
  );
}

export function MnemonicView({ card, onSaved }: { card: MnemonicCard; onSaved?: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(readSaved().includes(card.id)), [card.id]);
  const save = () => {
    tap();
    const all = readSaved();
    const now = !all.includes(card.id);
    try {
      localStorage.setItem(SAVED, JSON.stringify(now ? [...all, card.id] : all.filter((x) => x !== card.id)));
    } catch {}
    setSaved(now);
    onSaved?.();
    toast(now ? "Saved to your mnemonics" : "Removed from saved");
  };
  const share = async () => {
    tap();
    const text = `${card.title}\n"${card.phrase}"\n${card.letters.map(([l, w]) => `${l} = ${w}`).join("\n")}\n\nvia RamAI`;
    try {
      if (navigator.share) await navigator.share({ title: card.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied. Paste it anywhere.");
      }
    } catch {}
  };
  return (
    <article className="relative overflow-hidden rounded-3xl border border-line bg-[var(--surface-solid)] shadow-md">
      <header className="bg-gradient-to-r from-[#1B3A6B] to-[#2563EB] px-4 py-3 text-white">
        <h2 className="pr-12 text-[19px] leading-tight font-extrabold">{card.title}</h2>
      </header>
      <Mascot size={46} className="absolute top-2 right-2 rounded-full ring-2 ring-white/70" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-center text-[18px] leading-[26px] font-bold">
          “{phraseParts(card).map((p, i) => <span key={i} className={p.hit ? "text-[#dc2626]" : undefined}>{p.text}</span>)}”
        </p>
        {card.diagram ? <div className="overflow-hidden rounded-xl border border-line"><Diagram kind={card.diagram} /></div> : null}
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {card.letters.map(([l, w], i) => (
            <li key={`${l}${i}`} className="flex items-center gap-2 text-[14px] leading-[18px]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#dc2626] text-[13px] font-extrabold text-white">{l}</span>
              <span className="min-w-0 font-medium">{w}</span>
            </li>
          ))}
        </ul>
        {card.note && <p className="rounded-xl bg-amber-500/10 p-2.5 text-[13px] leading-[19px] text-fg-2"><b>Today&apos;s practice:</b> {card.note}</p>}
        <div className="rounded-xl bg-[#fff8e1] p-3 text-[#3d2c00]">
          <p className="text-[12px] font-extrabold tracking-wide">💡 QUICK RECALL</p>
          <p className="mt-1 text-[14px] leading-5 font-semibold">{card.recallQ}</p>
          <details className="mt-1 text-[14px] leading-5">
            <summary className="cursor-pointer font-medium underline">Show the answer</summary>
            <p className="mt-1">{card.recallA}</p>
          </details>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} className={cn("btn-lip min-h-11 flex-1 rounded-xl text-[14px] font-extrabold", saved ? "bg-surface-3 text-fg [--lip:var(--line)]" : "bg-[#dc2626] text-white [--lip:#991b1b]")}>{saved ? "SAVED ✓" : "SAVE THIS!"}</button>
          <button type="button" onClick={() => void share()} className="min-h-11 rounded-xl border border-line px-4 text-[14px] font-bold">Share</button>
        </div>
      </div>
    </article>
  );
}

export function MnemonicsTool() {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<MnemonicCard | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>("carpal");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  useEffect(() => setSaved(readSaved()), []);

  const make = async () => {
    setBusy(true);
    setError(null);
    const r = await generate<Omit<MnemonicCard, "id" | "icon">>("mnemonic", topic);
    setBusy(false);
    if (r.error || !r.result) return setError(r.error ?? "Please try again.");
    setMade({ ...r.result, id: `ai-${topic.trim().toLowerCase()}`, icon: "mnemonics" });
  };
  const list = MNEMONICS.filter((m) => (!onlySaved || saved.includes(m.id)) && `${m.title} ${m.phrase} ${m.letters.map((l) => l[1]).join(" ")}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <div className="pb-6">
      <ToolHeader title="Visual Mnemonics" line={`${MNEMONICS.length} ready-made cards. Or make one for any topic.`} />
      <Search value={topic} onChange={setTopic} onSubmit={() => void make()} busy={busy} action="GENERATE" placeholder="Causes of pancreatitis, Cranial nerves…" />
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
      {made && <div className="mt-4"><MnemonicView card={made} onSaved={() => setSaved(readSaved())} /><AiNote /></div>}
      <div className="mt-6 flex items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search the gallery" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] outline-none placeholder:text-fg-3" />
        <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved((x) => !x)} className={cn("h-10 rounded-xl border px-3 text-[13.5px] font-semibold", onlySaved ? "border-[#2563EB] text-accent-text" : "border-line text-fg-2")}>Saved ({saved.length})</button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {list.map((m) => (
          <div key={m.id}>
            {open === m.id ? (
              <MnemonicView card={m} onSaved={() => setSaved(readSaved())} />
            ) : (
              <button type="button" onClick={() => { tap(); setOpen(m.id); }} className="pick-card flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--surface-solid)] p-3 text-left">
                <MedicalIcon name={m.icon} size={40} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{m.title}</span>
                  <span className="block truncate text-[13px] text-fg-2">{m.phrase}</span>
                </span>
              </button>
            )}
          </div>
        ))}
        {!list.length && <p className="py-6 text-center text-[14px] text-fg-2">Nothing here yet.</p>}
      </div>
    </div>
  );
}
