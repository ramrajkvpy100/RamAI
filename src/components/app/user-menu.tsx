"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LangToggle } from "@/components/case/lang-toggle";
import { CountryPicker } from "@/components/app/country-picker";
import { useLauncher } from "@/components/home/use-launcher";
import { Avatar } from "@/components/game/avatar";
import { RankBadge } from "@/components/game/rank-badge";
import { Icon } from "@/components/ui/icon";
import { rankFor } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { logout } from "@/lib/engine-client";
import { clearMe, type Me } from "@/lib/me-store";
import { useThemePref, type ThemePref } from "@/lib/theme";

export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useThemePref();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const rank = rankFor(me.progress.percent);
  const { launch, starting } = useLauncher();

  useEffect(() => {
    if (!open) return;
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
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center rounded-full p-0.5 transition-shadow hover:shadow-[0_0_0_3px_var(--accent-soft)]" aria-label="Account menu">
        <Avatar name={me.user.name} size={32} />
      </button>
      {open && (
        <div role="menu" className="popover absolute top-full right-0 z-50 mt-2 w-[324px] max-w-[calc(100vw-24px)] animate-enter rounded-[20px] p-2">
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
            <Avatar name={me.user.name} size={38} />
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
              <div className="text-fg-2">{me.user.plan === "pro" ? "RamAI Pro" : "Free plan"}</div>
            </div>
            {me.user.plan !== "pro" && (
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
            disabled={starting}
            onClick={async () => {
              if (await launch({ tutorial: true })) setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-3 disabled:opacity-60"
          >
            <Icon name="sparkles" size={15} className="text-fg-2" /> {starting ? "Opening…" : "Guided demo case"}
          </button>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-[13.5px]">
            <span className="flex items-center gap-2.5">
              <Icon name="moon" size={15} className="text-fg-2" /> Theme
            </span>
            <span className="flex rounded-lg bg-surface-3 p-0.5">
              {(["light", "dark", "system"] as ThemePref[]).map((p) => (
                <button key={p} type="button" onClick={() => setPref(p)} className={cn("rounded-md px-2 py-0.5 text-[11.5px] capitalize", pref === p ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
                  {p === "system" ? "Auto" : p}
                </button>
              ))}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13.5px]">
            <span className="flex items-center gap-2.5">
              <Icon name="globe" size={15} className="text-fg-2" /> <span className="whitespace-nowrap">Practise in</span>
            </span>
            <CountryPicker />
          </div>
          {me.user.country === "IN" && (
            <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13.5px]">
              <span className="flex items-center gap-2.5">
                <Icon name="chat" size={15} className="text-fg-2" /> Patients speak
              </span>
              <LangToggle />
            </div>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
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
