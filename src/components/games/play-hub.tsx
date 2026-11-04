"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { MedicalIcon, type MedicalIconName } from "@/components/ui/medical-icons";
import { localStats, type GameStats } from "@/lib/games/score";

import { SectionDivider } from "./game-parts";

const GAMES: { href: string; icon: MedicalIconName; title: string; line: string; id?: "rush" | "synapses" | "probe" }[] = [
  { href: "/cases", icon: "clinical-games", title: "Clinical Games", line: "Diagnose and treat AI patients through clinical cases" },
  { href: "/practice/rush", icon: "image-rush", title: "Image Rush", line: "Identify medical images against the clock", id: "rush" },
  { href: "/practice/synapses", icon: "synapses", title: "Synapses", line: "Group medical concepts that belong together", id: "synapses" },
  { href: "/practice/probe", icon: "probe", title: "Probe", line: "Solve medical mysteries by connecting clues", id: "probe" },
];

/** The four games: under its heading, on Home and in the Skills Lab. XP from these is separate from the clinical rating. */
export function PlayHub({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<GameStats | null>(null);
  useEffect(() => {
    const here = localStats();
    setStats(here);
    // Signed in on another phone: the account's numbers are the fuller record.
    void fetch("/api/games/score").then((r) => (r.ok ? (r.json() as Promise<GameStats>) : null)).then((far) => {
      if (far && far.xp > here.xp) setStats(far);
    }).catch(() => undefined);
  }, []);
  return (
    <section className="flex flex-col gap-3">
      <SectionDivider>— Make practice feel like play —</SectionDivider>
      <div className={compact ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5 sm:grid sm:grid-cols-2"}>
        {GAMES.map((g) => (
          <Link key={g.href} href={g.href} className={`pick-card flex rounded-2xl border border-line bg-[var(--surface-solid)] p-3.5 ${compact ? "min-h-[140px] flex-col items-start gap-2" : "items-center gap-3"}`}>
            <MedicalIcon name={g.icon} size={compact ? 48 : 56} />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">{g.title}</span>
              <span className="block text-[13px] leading-[18px] text-fg-2">{g.line}</span>
              {g.id && !!stats?.best[g.id] && <span className="mt-1 block text-[12px] font-semibold text-accent-text">Best {stats.best[g.id]!.toLocaleString("en-IN")}</span>}
            </span>
          </Link>
        ))}
      </div>
      {!!stats?.xp && <p className="text-center text-[12.5px] text-fg-3">{stats.xp.toLocaleString("en-IN")} game XP. Your clinical rating only moves with full cases.</p>}
    </section>
  );
}

/** Until it's done or dismissed: a way into the optional welcome. */
export function WelcomeBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem("ramai.welcome.done"));
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="welcome-bg relative flex items-center gap-3 rounded-2xl p-3.5 text-white">
      <Link href="/welcome" className="flex min-w-0 flex-1 items-center gap-3">
        <MedicalIcon name="clinical-games" />
        <span className="min-w-0">
          <span className="block text-[15.5px] font-bold">What&apos;s your dream branch?</span>
          <span className="block text-[13px] text-white/75">Take a minute to set up RamAI for it.</span>
        </span>
      </Link>
      <button type="button" aria-label="Dismiss" onClick={() => { setShow(false); try { localStorage.setItem("ramai.welcome.done", "1"); } catch {} }} className="shrink-0 p-1 text-white/70"><Icon name="x" size={16} /></button>
    </div>
  );
}
