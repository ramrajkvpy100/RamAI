"use client";

import { setLook, useLook, type Look } from "./my-doctor";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

/** Male or female doctor in the rank pictures. */
export function LookChoice() {
  const look = useLook();
  return (
    <div className="flex rounded-full bg-surface-3 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Doctor in the rank pictures">
      {([["m", "👨‍⚕️ Male"], ["f", "👩‍⚕️ Female"]] as [Look, string][]).map(([l, label]) => (
        <button key={l} type="button" role="radio" aria-checked={look === l} onClick={() => { tap(); setLook(l); }} className={cn("rounded-full px-3 py-1 font-medium", look === l ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
          {label}
        </button>
      ))}
    </div>
  );
}
