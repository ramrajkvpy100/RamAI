"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";
import { GoalRing } from "@/components/game/goal-ring";
import { StreakPill } from "@/components/game/streak";
import { cn } from "@/lib/cn";
import { useMe, type Me } from "@/lib/me-store";

import { ExamMenu } from "./exam-menu";
import { InstallButton } from "./install-button";
import { UserMenu } from "./user-menu";

/** Kept to four: the rest (exams, community, leaderboard) is in the profile menu. */
const NAV = [
  { href: "/", label: "Cases" },
  { href: "/practice", label: "Skills Lab" },
  { href: "/progress", label: "Progress" },
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
            <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors", (n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}>
              {n.label}
            </Link>
          ))}
          <ExamMenu country={me.user.country} />
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <Link href="/support" aria-label="Donate to RamAI" className="flex h-8 items-center gap-1.5 rounded-full bg-rose-500/10 px-3 text-[13px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:text-rose-400">
            <span aria-hidden>♥</span><span className="hidden min-[400px]:inline">Donate</span>
          </Link>
          <InstallButton />
          <StreakPill days={me.progress.streakDays} />
          <Link href="/profile" className="hidden items-center sm:flex" aria-label="Daily goal">
            <GoalRing value={me.progress.dailyXp} goal={me.progress.dailyGoal} size={32} stroke={4}>
              <span className="text-[9px] font-semibold text-fg-2 tabular">{Math.min(99, Math.round((me.progress.dailyXp / me.progress.dailyGoal) * 100))}</span>
            </GoalRing>
          </Link>
          <UserMenu me={me} />
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line/60 px-4 py-1.5 whitespace-nowrap sm:hidden" aria-label="Main">
        {[...NAV, { href: "/exams", label: "Exam MCQs" }].map((n) => (
          <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1 text-[13px] font-medium", (n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "bg-surface-3 text-fg" : "text-fg-2")}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
