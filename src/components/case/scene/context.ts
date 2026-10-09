"use client";

import { createContext, useContext } from "react";

import type { AlarmState } from "./bedside-monitor";

export interface SceneContextValue {
  alarm: AlarmState;
  /** The caller is talking (phone scene). */
  speaking: boolean;
  /** Opens the full patient panel (sheet on phones, tab on tablets). */
  openPatient: () => void;
}

const SceneContext = createContext<SceneContextValue>({
  alarm: { level: null, silenced: false, sound: false, silence: () => undefined },
  speaking: false,
  openPatient: () => undefined,
});

export const SceneProvider = SceneContext.Provider;
export const useScene = () => useContext(SceneContext);
