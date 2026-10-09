"use client";

import { IconButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tabs } from "@/components/ui/tabs";
import type { CaseState } from "@/engine/types";
import { cn } from "@/lib/cn";

import { PatientPanel } from "./patient-panel";
import { ResultsList } from "./results-list";
import { Timeline } from "./timeline";

export type PanelTab = "patient" | "results" | "timeline";

/** The encounter's side panel: Patient (when there's no patient column), Results, Timeline. */
export function ToolsPanel({
  state,
  includePatient,
  flashKeys,
  highlightIds,
  tab,
  onTab,
  onHide,
}: {
  state: CaseState;
  includePatient: boolean;
  flashKeys: Set<string>;
  highlightIds: Set<string>;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onHide?: () => void;
}) {
  const pending = state.investigations.filter((i) => i.status === "pending").length;
  const resulted = state.investigations.length - pending;
  const items = [
    ...(includePatient ? [{ id: "patient" as const, label: "Patient" }] : []),
    {
      id: "results" as const,
      label: "Results",
      badge: state.investigations.length ? <span className="text-[10.5px] text-fg-3 tabular">{resulted}{pending ? `+${pending}` : ""}</span> : undefined,
    },
    { id: "timeline" as const, label: "Timeline" },
  ];
  const active = !includePatient && tab === "patient" ? "results" : tab;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-line-2 py-3 pr-2 pl-4">
        <Tabs idPrefix="panel" label="Clinical information" items={items} value={active} onChange={onTab} className="flex-1" />
        {onHide && (
          <IconButton label="Hide panel" size="sm" onClick={onHide} className="text-fg-3 hover:text-fg">
            <Icon name="panel-right-close" size={17} />
          </IconButton>
        )}
      </div>
      <div className="scroll-area min-h-0 flex-1 px-4 py-5" role="tabpanel" id={`panel-panel-${active}`} aria-labelledby={`panel-tab-${active}`}>
        {active === "patient" && <PatientPanel state={state} flashKeys={flashKeys} />}
        {active === "results" && <ResultsList state={state} highlightIds={highlightIds} />}
        {active === "timeline" && <Timeline events={state.timeline} />}
      </div>
    </div>
  );
}

/** The side panel folded away: a way back in, and a count of results waiting there. */
export function PanelRail({
  state,
  includePatient,
  fresh,
  onOpen,
}: {
  state: CaseState;
  includePatient: boolean;
  /** Results arrived this turn. */
  fresh: boolean;
  onOpen: (tab?: PanelTab) => void;
}) {
  const resulted = state.investigations.filter((i) => i.status === "resulted").length;
  const items: { id: PanelTab; label: string; icon: IconName; count?: number }[] = [
    ...(includePatient ? [{ id: "patient" as const, label: "Patient", icon: "user" as const }] : []),
    { id: "results", label: resulted ? `Results (${resulted})` : "Results", icon: "flask", count: resulted || undefined },
    { id: "timeline", label: "Timeline", icon: "timeline" },
  ];
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3">
      <IconButton label="Show panel" size="sm" onClick={() => onOpen()} className="text-fg-2 hover:text-fg">
        <Icon name="panel-right-open" size={17} />
      </IconButton>
      <span aria-hidden className="my-1.5 h-px w-5 bg-line" />
      {items.map((item) => (
        <IconButton key={item.id} label={item.label} size="sm" onClick={() => onOpen(item.id)} className="relative text-fg-3 hover:text-fg">
          <Icon name={item.icon} size={17} />
          {item.count !== undefined && (
            <span className={cn("absolute -top-0.5 -right-0.5 min-w-[15px] rounded-full bg-accent px-1 text-center text-[9.5px] leading-[15px] font-semibold text-on-accent tabular", fresh && "animate-pulse")}>{item.count}</span>
          )}
        </IconButton>
      ))}
    </div>
  );
}

