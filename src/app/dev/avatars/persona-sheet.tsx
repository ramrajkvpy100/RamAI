"use client";

import { useState } from "react";

import { PersonaAvatar } from "@/components/game/specialist-avatar";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { PERSONAS } from "@/lib/avatar-style";

export function PersonaSheet() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4">
      <button type="button" onClick={() => setOpen(true)} className="mb-4 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent">Open picker</button>
      <AvatarPicker open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-wrap gap-3">
        {PERSONAS.map((p) => (
          <div key={p.id} className="flex items-end gap-2">
            <PersonaAvatar persona={p.id} size={96} title={p.name} />
            <PersonaAvatar persona={p.id} size={28} />
          </div>
        ))}
      </div>
    </div>
  );
}
