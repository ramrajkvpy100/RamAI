"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { GoalRing } from "@/components/game/goal-ring";
import { StreakPill } from "@/components/game/streak";
import { cn } from "@/lib/cn";
import { useMe, type Me } from "@/lib/me-store";

import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function AppHeader({ initial }: { initial: Me }) {
  const me = useMe(initial) ?? initial;
  const path = usePathname();
  return (
    <header className="material-bar sticky top-0 z-40 border-b border-[var(--material-stroke)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="RamAI — home" className="rounded-lg">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors", path === n.href ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <StreakPill days={me.progress.streakDays} />
          <Link href="/profile" className="hidden items-center sm:flex" aria-label="Daily goal">
            <GoalRing value={me.progress.dailyXp} goal={me.progress.dailyGoal} size={32} stroke={4}>
              <span className="text-[9px] font-semibold text-fg-2 tabular">{Math.min(99, Math.round((me.progress.dailyXp / me.progress.dailyGoal) * 100))}</span>
            </GoalRing>
          </Link>
          <UserMenu me={me} />
        </div>
      </div>
      <nav className="flex items-center gap-1 border-t border-line/60 px-4 py-1.5 sm:hidden" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1 text-[13px] font-medium", path === n.href ? "bg-surface-3 text-fg" : "text-fg-2")}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
