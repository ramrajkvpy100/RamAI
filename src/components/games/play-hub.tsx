"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { MedicalIcon } from "@/components/ui/medical-icons";

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
