"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { Country } from "@/engine/countries";
import { cn } from "@/lib/cn";
import { useCareerStage } from "@/lib/career-stage";
import { examsFor } from "@/lib/exams";

/** "Exam practice ▾" — only the exams of the country the doctor practises in. */
export function ExamMenu({ country, className }: { country: Country; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const exams = examsFor(country, useCareerStage());
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors", path.startsWith("/exams") ? "bg-surface-3 text-fg" : "text-fg-2 hover:text-fg")}
      >
        Exam practice <Icon name="chevron-down" size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="popover absolute top-full left-0 z-50 mt-2 w-60 animate-enter rounded-2xl p-1.5">
          {exams.map((e) => (
            <Link key={e.id} role="menuitem" href={`/exams/${e.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[14px] font-medium hover:bg-surface-3">
              {e.label} PYQ-pattern MCQs
              <Icon name="arrow-right" size={13} className="text-fg-3" />
            </Link>
          ))}
          <Link role="menuitem" href="/exams" className="mt-1 block rounded-xl border-t border-line px-3 py-2 text-[12.5px] text-fg-2 hover:bg-surface-3">
            Your scores by exam
          </Link>
        </div>
      )}
    </div>
  );
}
