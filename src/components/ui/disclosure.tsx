"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";

/** An accessible expandable section with a smooth height transition. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  headerClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn("group flex w-full items-center gap-3 text-left", headerClassName)}
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <Icon name="chevron-down" className={cn("shrink-0 text-fg-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div
        id={id}
        role="region"
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          {children}
        </div>
      </div>
    </div>
  );
}
