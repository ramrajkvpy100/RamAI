"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { DebriefView } from "@/components/debrief/debrief-view";
import { UpgradeSheet } from "@/components/home/upgrade-sheet";
import { useLauncher } from "@/components/home/use-launcher";
import { MediaViewerProvider, type ViewerItem } from "@/components/media/media-viewer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import type { CaseState, PatientStatus, TurnEffect } from "@/engine/types";
import { abandonCase, beginEncounter, dismissError, hydrate, retry, send, useCase } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { primeMe, useMe, type Me } from "@/lib/me-store";
import { alarm, chime, setSoundEnabled, useSoundEnabled } from "@/lib/monitor-audio";
import { useMediaQuery } from "@/lib/use-media-query";

import { Briefing } from "./briefing";
import { CaseTopBar } from "./case-top-bar";
import { Coach } from "./coach";
import { Composer } from "./composer";
import { ComposerProvider } from "./composer-context";
import { Conversation } from "./conversation";
import { EncounterProgress } from "./encounter-progress";
import { EndCaseDialog } from "./end-case";
import { PatientPanel } from "./patient-panel";
import { ResultsList } from "./results-list";
import type { AlarmState } from "./scene/bedside-monitor";
import { SceneProvider } from "./scene/context";
import { LiveMonitorProvider } from "./scene/live-monitor";
import { alarmLevel, sceneFor } from "./scene/scene";
import { SceneStrip } from "./scene/scene-strip";
import { Timeline } from "./timeline";
import { PanelRail, ToolsPanel, type PanelTab } from "./tools-panel";

/* -------------------------------------------------------------------------- */

function useTurnHighlights(state: CaseState | undefined, effects: TurnEffect[], turn: number) {
  const seen = useRef<Set<string> | null>(null);
  return useMemo(() => {
    const newIds = new Set<string>();
    const flash = new Set<string>();
    const highlight = new Set<string>();
    if (!state) return { newIds, flash, highlight };
    if (seen.current) for (const m of state.messages) if (!seen.current.has(m.id)) newIds.add(m.id);
    seen.current = new Set(state.messages.map((m) => m.id));
    for (const e of effects) {
      if (e.type === "vitals") for (const r of e.readings) flash.add(`vital:${r.key}`);
      if (e.type === "fact") flash.add(`fact:${e.label}`);
      if (e.type === "investigation_resulted") highlight.add(e.instanceId);
    }
    return { newIds, flash, highlight };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.messages.length, turn]);
}

const SEVERITY: Record<PatientStatus, number> = { recovered: 0, improving: 1, stable: 2, guarded: 3, deteriorating: 4, critical: 5, deceased: 6 };
const SILENCE_MS = 120_000;

/** Monitor alarms: repeat while a parameter is out of limits (if sound is on), silence for 2 minutes, chime on status change. */
function useMonitorAlarms(state: CaseState): AlarmState {
  const sound = useSoundEnabled();
  const level = alarmLevel(state);
  const [silencedAt, setSilencedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const silenced = silencedAt !== null && Date.now() - silencedAt < SILENCE_MS;

  useEffect(() => {
    if (silencedAt === null) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.max(0, SILENCE_MS - (Date.now() - silencedAt)) + 50);
    return () => clearTimeout(id);
  }, [silencedAt]);

  // A new high-priority alarm always sounds, even if a lesser one was silenced.
  const previous = useRef(level);
  useEffect(() => {
    if (level === "high" && previous.current !== "high") setSilencedAt(null);
    previous.current = level;
  }, [level]);

  useEffect(() => {
    if (!sound || !level || silenced) return;
    alarm(level);
    const id = setInterval(() => alarm(level), level === "high" ? 4500 : 9000);
    return () => clearInterval(id);
  }, [sound, level, silenced]);

  const lastStatus = useRef(state.patientStatus);
  useEffect(() => {
    const prev = lastStatus.current;
    lastStatus.current = state.patientStatus;
    if (prev !== state.patientStatus && sound) chime(SEVERITY[state.patientStatus] > SEVERITY[prev]);
  }, [state.patientStatus, sound]);

  return { level, silenced, sound, silence: () => setSilencedAt(Date.now()) };
}

/** On a phone call, the voice bars move for a moment whenever the caller speaks. */
function useCallerSpeaking(state: CaseState, newIds: Set<string>, turn: number) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (state.track !== "phone") return;
    if (!state.messages.some((m) => newIds.has(m.id) && (m.role === "attendant" || m.role === "patient"))) return;
    setSpeaking(true);
    const id = setTimeout(() => setSpeaking(false), 2800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);
  return speaking;
}

/** Every image in the case, in the order it appeared — for the viewer's ← →. */
function useViewerItems(state: CaseState): ViewerItem[] {
  return useMemo(() => {
    const items: (ViewerItem & { at: number })[] = [];
    for (const m of state.messages) if (m.media) items.push({ key: m.id, media: m.media, title: m.text.split(" — ")[0]?.slice(0, 60) || "Image", at: m.at });
    for (const inv of state.investigations) if (inv.status === "resulted" && inv.media) items.push({ key: inv.id, media: inv.media, title: inv.name, at: inv.resultAt });
    return items.sort((a, b) => a.at - b.at);
  }, [state.messages, state.investigations]);
}

const PANEL_KEY = "ramai.case.panel";

/** Whether the right-hand panel is shown — remembered on this device. */
function usePanelOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== "hidden";
    } catch {
      return true;
    }
  });
  const set = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(PANEL_KEY, next ? "shown" : "hidden");
    } catch {}
  }, []);
  return [open, set];
}

/* -------------------------------------------------------------------------- */

function Workspace() {
  const snap = useCase();
  const session = snap.session!;
  const state = session.state;
  const xl = useMediaQuery("(min-width: 1280px)");
  const md = useMediaQuery("(min-width: 768px)");
  const [tab, setTab] = useState<PanelTab>("patient");
  const [sheet, setSheet] = useState<PanelTab | null>(null);
  const [ending, setEnding] = useState(false);
  const [panelOpen, setPanelOpen] = usePanelOpen();
  const { newIds, flash, highlight } = useTurnHighlights(state, snap.lastEffects, snap.turn);
  const alarmState = useMonitorAlarms(state);
  const speaking = useCallerSpeaking(state, newIds, snap.turn);
  const viewerItems = useViewerItems(state);
  const scene = sceneFor(state);

  // When results arrive, bring the Results tab forward (never steals focus).
  useEffect(() => {
    if (highlight.size && tab !== "timeline") setTab("results");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.turn]);

  const history = useMemo(() => state.messages.filter((m) => m.role === "doctor").map((m) => m.text), [state.messages]);
  const deceased = state.patientStatus === "deceased";
  const onSend = useCallback((text: string) => send(text), []);
  const openPatient = useCallback(() => {
    if (!md) return setSheet("patient");
    setTab("patient");
    setPanelOpen(true);
  }, [md, setPanelOpen]);
  const sceneValue = useMemo(() => ({ alarm: alarmState, speaking, openPatient }), [alarmState, speaking, openPatient]);

  const endCase = () => {
    setEnding(false);
    void send("End case");
  };

  return (
    <SceneProvider value={sceneValue}>
      <LiveMonitorProvider state={state}>
        <MediaViewerProvider items={viewerItems}>
          <div className="flex h-dvh flex-col">
            <CaseTopBar state={state} onClose={() => setEnding(true)} sound={scene === "monitor" ? { on: alarmState.sound, toggle: () => setSoundEnabled(!alarmState.sound) } : null} />
            <div
              className={cn(
                "grid min-h-0 flex-1 grid-cols-1 transition-[grid-template-columns] duration-200 ease-out",
                panelOpen ? "md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[340px_minmax(0,1fr)_360px]" : "md:grid-cols-[minmax(0,1fr)_48px] xl:grid-cols-[340px_minmax(0,1fr)_48px]",
              )}
            >
              <aside className="scroll-area hidden border-r border-line bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)] px-5 py-5 xl:block" aria-label="Patient">
                <PatientPanel state={state} flashKeys={flash} />
              </aside>

              <main className="flex min-h-0 flex-col" aria-label="Encounter">
                <SceneStrip state={state} className="xl:hidden" />
                <div className="hidden border-b border-line-2 px-4 py-2.5 sm:block sm:px-6">
                  <EncounterProgress stage={state.stage} touched={state.stagesTouched} className="mx-auto max-w-[760px]" />
                </div>
                <Conversation state={state} sendingInput={snap.sending?.input ?? null} newIds={newIds} highlightIds={highlight} />

                <div className="px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                  <div className="mx-auto flex max-w-[760px] flex-col gap-2">
                    {snap.error && (
                      <div role="alert" className="flex animate-enter items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-sm">
                        <Icon name="alert" size={15} className="shrink-0 text-warning" />
                        <p className="flex-1 text-ui">{snap.error.message}</p>
                        {snap.error.retryable && (
                          <Button size="sm" variant="secondary" onClick={() => void retry()}>
                            <Icon name="refresh" size={13} /> Retry
                          </Button>
                        )}
                        <button type="button" onClick={dismissError} className="text-fg-3 hover:text-fg" aria-label="Dismiss">
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    )}
                    {deceased && (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
                        <p className="text-ui text-fg-2">The patient has died. End the case to review the encounter.</p>
                        <Button size="sm" variant="primary" onClick={endCase} disabled={!!snap.sending}>
                          End case
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1 md:hidden">
                      {(["patient", "results", "timeline"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setSheet(t)} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-ui whitespace-nowrap text-fg-2 capitalize hover:bg-surface-3 hover:text-fg">
                          {t}
                          {t === "results" && state.investigations.length > 0 && <span className="text-[10.5px] text-fg-3 tabular">{state.investigations.length}</span>}
                        </button>
                      ))}
                      <button type="button" onClick={() => setEnding(true)} data-coach-target="end-case" className="ml-auto flex h-8 items-center rounded-full px-3 text-ui font-medium whitespace-nowrap text-fg-2 hover:bg-surface-3 hover:text-fg">
                        End case
                      </button>
                    </div>
                    <Coach state={state} />
                  <Composer onSend={onSend} sending={!!snap.sending} disabled={false} history={history} phone={state.track === "phone"} />
                  </div>
                </div>
              </main>

              <aside className="hidden min-h-0 overflow-hidden border-l border-line md:flex md:flex-col" aria-label="Clinical information">
                {panelOpen ? (
                  // Fixed width inside a clipping column: the panel slides rather than squeezes.
                  <div className="h-full min-h-0 w-[340px] xl:w-[360px]">
                    <ToolsPanel state={state} includePatient={!xl} flashKeys={flash} highlightIds={highlight} tab={tab} onTab={setTab} onHide={() => setPanelOpen(false)} />
                  </div>
                ) : (
                  <PanelRail
                    state={state}
                    includePatient={!xl}
                    fresh={highlight.size > 0}
                    onOpen={(t) => {
                      if (t) setTab(t);
                      setPanelOpen(true);
                    }}
                  />
                )}
              </aside>
            </div>

            <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet ? sheet[0]!.toUpperCase() + sheet.slice(1) : ""} placement="bottom" className="md:hidden">
              {sheet === "patient" && <PatientPanel state={state} flashKeys={flash} />}
              {sheet === "results" && <ResultsList state={state} highlightIds={highlight} />}
              {sheet === "timeline" && <Timeline events={state.timeline} />}
            </Sheet>

            <EndCaseDialog open={ending} onClose={() => setEnding(false)} onConfirm={endCase} busy={!!snap.sending} />
          </div>
        </MediaViewerProvider>
      </LiveMonitorProvider>
    </SceneProvider>
  );
}

/* -------------------------------------------------------------------------- */

function NoCase({ onStart, starting, error }: { onStart: () => void; starting: boolean; error: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5">
        <Link href="/" aria-label="RamAI — home" className="rounded-lg">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="micro text-fg-2">No active case</div>
          <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">Your next patient is waiting.</h1>
          <div className="mt-7 flex justify-center gap-2">
            <button type="button" onClick={onStart} disabled={starting} className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow disabled:opacity-70">
              {starting ? "Preparing case…" : "Start case"}
            </button>
            <Link href="/" className="inline-flex h-12 items-center rounded-full px-5 text-[15px] font-medium text-fg-2 hover:text-fg">
              Home
            </Link>
          </div>
          {error && (
            <p className="mt-5 text-ui text-fg-2" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export function CaseScreen({ me: initial }: { me: Me }) {
  const snap = useCase();
  const me = useMe(initial) ?? initial;
  const { launch, starting, gate, closeGate, error } = useLauncher();
  useEffect(() => primeMe(initial), [initial]);
  useEffect(() => hydrate(initial.user.id), [initial.user.id]);

  let screen: React.ReactNode;
  if (!snap.hydrated || snap.userId !== initial.user.id) {
    screen = <div className="min-h-dvh" aria-busy="true" />;
  } else if (!snap.session) {
    screen = <NoCase onStart={() => void launch({})} starting={starting} error={error} />;
  } else if (snap.session.debrief) {
    screen = <DebriefView session={snap.session} progress={me.progress} onNext={() => void launch({})} onHome={abandonCase} starting={starting} guest={me.user.isGuest} />;
  } else if (!snap.session.begun) {
    screen = <Briefing state={snap.session.state} onBegin={beginEncounter} />;
  } else {
    screen = (
      <ComposerProvider>
        <Workspace />
      </ComposerProvider>
    );
  }

  return (
    <>
      {screen}
      <UpgradeSheet gate={gate} onClose={closeGate} />
    </>
  );
}
