"use client";

import Link from "next/link";

import { MedicalIcon, type MedicalIconName } from "@/components/ui/medical-icons";

export const LEARNING_TOOLS: { href: string; icon: MedicalIconName; title: string; line: string }[] = [
  { href: "/tools/mnemonics", icon: "mnemonics", title: "Mnemonics", line: "Generate mnemonics" },
  { href: "/tools/flowcharts", icon: "flowcharts", title: "Flowcharts", line: "Get flowcharts on demand" },
  { href: "/tools/youtube", icon: "youtube", title: "YouTube", line: "Playlists by subject, and video summaries" },
  { href: "/tools/notes", icon: "notes", title: "Create smart notes", line: "Upload your notes" },
  { href: "/tools/research", icon: "research", title: "Latest research", line: "Get updates" },
];

export function ToolRows() {
  return (
    <div className="flex flex-col gap-2">
      {LEARNING_TOOLS.map((t) => (
        <Link key={t.href} href={t.href} className="pick-card flex items-center gap-3 rounded-2xl border border-line bg-[var(--surface-solid)] p-3">
          <MedicalIcon name={t.icon} />
          <span className="min-w-0">
            <span className="block text-[15.5px] font-bold">{t.title}</span>
            <span className="block text-[13px] text-fg-2">{t.line}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ToolsHub() {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div>
        <h1 className="text-[26px] font-bold">MedKit</h1>
        <p className="mt-0.5 text-[14.5px] text-fg-2">Your study tools. Galleries are free; AI generation is 5 a day with a free account.</p>
      </div>
      <ToolRows />
    </div>
  );
}
