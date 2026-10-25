"use client";

import { SearchButton } from "./search-box";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotInAndroidApp } from "@/components/app/android-app";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Wordmark } from "@/components/brand/wordmark";
import { GoalRing } from "@/components/game/goal-ring";
import { StreakPill } from "@/components/game/streak";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useMe, type Me } from "@/lib/me-store";

import { ExamMenu } from "./exam-menu";
import { InstallButton } from "./install-button";
import { UserMenu } from "./user-menu";

/** The main places — always in sight: across the top on a computer, as a tab bar at the bottom on a phone. */
const NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/cases", label: "Cases", icon: "pulse" },
  { href: "/practice", label: "Skills Lab", icon: "target" },
  { href: "/leaderboard", label: "Leaderboard", icon: "trophy" },
  { href: "/community", label: "Community", icon: "users" },
  { href: "/progress", label: "Progress", icon: "award" },
] as const;
// (Five fit a phone: the leaderboard is a big tile on Home, and in the menu.)
const PHONE_NAV = [NAV[0], NAV[1], NAV[2], { href: "/exams", label: "Exams", icon: "file" }, NAV[4]] as const;

export function AppHeader({ initial }: { initial: Me }) {
  const me = useMe(initial) ?? initial;
  const path = usePathname();
  return (
    <>
    <header className="material-bar sticky top-0 z-40 border-b border-[var(--material-stroke)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-3 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="RamAI — home" className="rounded-lg">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} prefetch className={cn("rounded-lg px-3 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors", (n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}>
              {n.label}
            </Link>
          ))}
          <ExamMenu country={me.user.country} />
        </nav>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
          <SearchButton />
          <NotInAndroidApp>
            <Link href="/support" aria-label="Donate to RamAI" className="flex h-8 items-center gap-1.5 rounded-full bg-rose-500/10 px-3 text-[13px] font-semibold text-rose-600 hover:bg-rose-500/15 dark:text-rose-400">
              <span aria-hidden>♥</span><span className="hidden min-[400px]:inline">Donate</span>
            </Link>
            <InstallButton />
          </NotInAndroidApp>
          <Link href="/focus" aria-label="Focus timer" title="Focus timer" className={cn("flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold transition-colors", path === "/focus" ? "bg-emerald-600 text-white" : "bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300")}>
            <span aria-hidden>☕</span><span className="hidden min-[380px]:inline">Focus</span>
          </Link>
          <span className="hidden sm:contents"><ThemeToggle /></span>
          <StreakPill days={me.progress.streakDays} />
          <Link href="/profile" className="hidden items-center sm:flex" aria-label="Daily goal">
            <GoalRing value={me.progress.dailyXp} goal={me.progress.dailyGoal} size={32} stroke={4}>
              <span className="text-[9px] font-semibold text-fg-2 tabular">{Math.min(99, Math.round((me.progress.dailyXp / me.progress.dailyGoal) * 100))}</span>
            </GoalRing>
          </Link>
          <UserMenu me={me} />
        </div>
      </div>
    </header>
    {/* The tab bar sits outside the header: the header's blur would pin a fixed bar to itself. */}
      {/* Phones: a tab bar along the bottom, like an app. */}
      <nav className="tabbar-solid fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--material-stroke)] pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Main">
        {PHONE_NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            // (prefetch: each tab's page and data are fetched ahead, so a tap opens it at once.)
            <Link key={n.href} href={n.href} prefetch aria-current={on ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium", on ? "text-accent-text" : "text-fg-2")}>
              <Icon name={n.icon} size={20} strokeWidth={on ? 2.3 : 1.8} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
