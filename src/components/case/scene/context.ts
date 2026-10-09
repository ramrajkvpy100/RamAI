"use client";

import { createContext, useContext } from "react";

import type { AlarmState } from "./bedside-monitor";

export interface SceneContextValue {
  alarm: AlarmState;
  /** The caller is talking (phone scene). */
  speaking: boolean;
  /** Opens the full patient panel (sheet on phones, tab on tablets). */
  openPatient: () => void;
  /** Puts the patient on the bedside monitor — the same as typing the order. */
  attachMonitor: () => void;
  /** A turn is being sent. */
  busy: boolean;
}

const SceneContext = createContext<SceneContextValue>({
  alarm: { level: null, silenced: false, sound: false, silence: () => undefined },
  speaking: false,
  openPatient: () => undefined,
  attachMonitor: () => undefined,
  busy: false,
});

export const SceneProvider = SceneContext.Provider;
export const useScene = () => useContext(SceneContext);
