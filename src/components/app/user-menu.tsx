"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LangToggle } from "@/components/case/lang-toggle";
import { CountryPicker } from "@/components/app/country-picker";
import { AppOptions } from "@/components/app/app-options";
import { TOUR_EVENT } from "@/components/home/home-tour";
import { SPECIALTY_EVENT } from "@/components/home/specialty-sheet";
import { useLauncher } from "@/components/home/use-launcher";
import { Avatar } from "@/components/game/avatar";
import { RankBadge } from "@/components/game/rank-badge";
import { Icon } from "@/components/ui/icon";
import { rankFor } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { disableReminders } from "@/lib/app-install";
import { logout } from "@/lib/engine-client";
import { clearMe, type Me } from "@/lib/me-store";
import { specialtyLabel } from "@/lib/specialty";
import { useThemePref, type ThemePref } from "@/lib/theme";
import { PRO_FOR_EVERYONE } from "@/lib/plans";
import { setSfxEnabled, useSfxEnabled } from "@/lib/sfx";

export function UserMenu({ me }: { me: Me }) {
  const sfx = useSfxEnabled();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [pref, setPref] = useThemePref();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const rank = rankFor(me.progress.percent);
  const { launch, starting } = useLauncher();

  useEffect(() => {
    if (!open) {
      setMore(false);
      return;
    }
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref} data-tour="menu">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center rounded-full p-0.5 transition-shadow hover:shadow-[0_0_0_3px_var(--accent-soft)]" aria-label="Account menu">
        <Avatar name={me.user.name} size={32} style={me.avatar} />
      </button>
      {open && (
        <div role="menu" className="popover absolute top-full right-0 z-50 mt-2 max-h-[calc(100dvh-90px)] w-[324px] max-w-[calc(100vw-24px)] animate-enter overflow-y-auto overscroll-contain rounded-[20px] p-2">
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
            <Avatar name={me.user.name} size={38} style={me.avatar} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{me.user.name}</div>
              <div className="truncate text-[12px] text-fg-2">{me.user.isGuest ? "Guest — not signed up" : `@${me.user.username}`}</div>
              {!me.user.isGuest && (
                <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11.5px]">
                  <span className="truncate text-fg-3">{me.user.email}</span>
                  {me.user.emailVerified ? (
                    <Icon name="check" size={12} strokeWidth={2.4} className="shrink-0 text-success" label="Email verified" />
                  ) : (
                    <span className="shrink-0 font-medium text-warning">· unverified</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mx-1 mb-1 flex items-center gap-2.5 rounded-xl bg-surface-3/70 px-3 py-2.5">
            <RankBadge tier={rank.tier} size={22} />
            <div className="min-w-0 flex-1 text-[12.5px]">
              <div className="font-medium">{rank.label}</div>
              <div className="text-fg-2">{me.user.plan === "pro" ? "RamAI Pro" : PRO_FOR_EVERYONE ? "Pro · free for now" : "Free plan"}</div>
            </div>
            {me.user.plan !== "pro" && !PRO_FOR_EVERYONE && (
              <Link href="/pricing" onClick={() => setOpen(false)} className="bg-ai rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-white">
                Upgrade
              </Link>
            )}
          </div>
          {me.user.isGuest ? (
            <Link role="menuitem" href="/signup" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-accent-text hover:bg-surface-3">
              <Icon name="sparkles" size={15} /> Create free account
            </Link>
          ) : (
            <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] hover:bg-surface-3">
              <Icon name="user" size={15} className="text-fg-2" /> Profile
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              if (window.location.pathname === "/") window.dispatchEvent(new Event(SPECIALTY_EVENT));
              else router.push("/?specialty=1");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-3"
          >
            <Icon name="pulse" size={15} className="text-fg-2" /> Your specialty
            <span className="ml-auto max-w-[140px] truncate text-[12.5px] text-fg-2">{me.user.specialty ? specialtyLabel(me.user.specialty).replace(" — every specialty", "") : "Not set"}</span>
          </button>
          {([["/exams", "file", "Exam MCQs"]] as const).map(([href, icon, label]) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] hover:bg-surface-3">
              <Icon name={icon} size={15} className="text-fg-2" /> {label}
            </Link>
          ))}
          <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-3">
            <Icon name="sparkles" size={15} className="text-fg-2" /> More
            <Icon name="chevron-down" size={14} className={cn("ml-auto text-fg-2 transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <div className="flex flex-col gap-2 px-1 pb-1">
              <div className="grid grid-cols-3 gap-1.5">
                <button role="menuitem" type="button" disabled={starting} onClick={async () => { if (await launch({ tutorial: true })) setOpen(false); }} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60">
                  <span aria-hidden className="text-[18px]">✨</span>{starting ? "Opening…" : "Demo case"}
                </button>
                <button role="menuitem" type="button" onClick={() => { setOpen(false); if (window.location.pathname === "/") window.dispatchEvent(new Event(TOUR_EVENT)); else router.push("/?tour=1"); }} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60">
                  <span aria-hidden className="text-[18px]">🧭</span>Quick tour
                </button>
                <Link role="menuitem" href="/achievements" onClick={() => setOpen(false)} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60">
                  <span aria-hidden className="text-[18px]">🏅</span>Badges · {me.progress.badges.length}
                </Link>
                <Link role="menuitem" href="/suggestions" onClick={() => setOpen(false)} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60">
                  <span aria-hidden className="text-[18px]">💡</span>Suggest
                </Link>
                <Link role="menuitem" href="/support" onClick={() => setOpen(false)} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60">
                  <span aria-hidden className="text-[18px]">❤️</span>Support
                </Link>
                {me.admin && (
                  <Link role="menuitem" href="/admin/suggestions" onClick={() => setOpen(false)} className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-3/60 px-2 py-2.5 text-center text-[12px] font-medium leading-tight hover:bg-surface-3 disabled:opacity-60 relative">
                    <span aria-hidden className="text-[18px]">🛡️</span>Admin
                    {!!me.newSuggestions && <span className="absolute top-1 right-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white tabular">{me.newSuggestions}</span>}
                  </Link>
                )}
              </div>
              {me.admin && (
                <div className="flex gap-1.5 text-[11.5px]">
                  <Link href="/admin/access" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-surface-3/60 px-2 py-1.5 text-center hover:bg-surface-3">🔑 Invites</Link>
                  <Link href="/admin/costs" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-surface-3/60 px-2 py-1.5 text-center hover:bg-surface-3">📊 AI costs</Link>
                  <Link href="/admin/reports" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-surface-3/60 px-2 py-1.5 text-center hover:bg-surface-3">🚩 Reports</Link>
                </div>
              )}
              <div className="mt-1 flex flex-col gap-2.5 rounded-xl bg-surface-3/40 p-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span>🔊 Sounds</span>
                  <button role="menuitemcheckbox" aria-checked={sfx} type="button" onClick={() => setSfxEnabled(!sfx)} className={cn("relative h-6 w-11 rounded-full transition-colors", sfx ? "bg-success" : "bg-surface-3")}>
                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", sfx ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span>🌗 Theme</span>
                  <span className="flex rounded-lg bg-surface p-0.5">
                    {(["light", "dark", "system"] as ThemePref[]).map((p) => (
                      <button key={p} type="button" onClick={() => setPref(p)} className={cn("rounded-md px-2 py-0.5 text-[11.5px] capitalize", pref === p ? "bg-surface-3 text-fg shadow-sm" : "text-fg-2")}>
                        {p === "system" ? "Auto" : p}
                      </button>
                    ))}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span>🌍 Practise in</span>
                  <div className="max-w-full overflow-x-auto">
                    <CountryPicker />
                  </div>
                </div>
                {me.user.country === "IN" && (
                  <div className="flex items-center justify-between gap-2">
                    <span>💬 Patients speak</span>
                    <LangToggle />
                  </div>
                )}
              </div>
              <AppOptions guest={me.user.isGuest} onNavigate={() => setOpen(false)} />
            </div>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              // Reminders belong to this account, not to whoever uses this browser next.
              await disableReminders().catch(() => null);
              await logout().catch(() => null);
              clearMe();
              router.push("/");
              router.refresh();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-3"
          >
            <Icon name="logout" size={15} className="text-fg-2" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
