"use client";

/**
 * Patients and families speak aloud — the browser's own speech synthesis
 * (free and on-device), in an Indian, American or British accent to match
 * the case. Off until the player turns it on.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { Country } from "@/engine/countries";
import type { CaseState } from "@/engine/types";

const KEY = "ramai.voices";
let enabled: boolean | null = null;
/** Set when the player switches voices on, so the latest line is read as feedback — never just on page load. */
let announce = false;
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(KEY) === "1";
  } catch {
    enabled = false;
  }
  return enabled;
}

export const voicesSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

export function setVoicesEnabled(on: boolean) {
  enabled = on;
  announce = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  if (!on && voicesSupported()) window.speechSynthesis.cancel();
  listeners.forEach((l) => l());
}

export function useVoicesEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readEnabled,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */
/* Choosing a voice                                                            */
/* -------------------------------------------------------------------------- */

const ACCENT: Record<Country, string> = { IN: "en-in", US: "en-us", UK: "en-gb" };
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|fiona|veena|lekha|kate\b|serena|susan|zira|hazel|heera|neerja|aria\b|jenny|sonia|libby|ava\b|allison|nicky|zoe\b|joelle|kathy|isha\b|kajal|swara|aditi|raveena|emma\b|amy\b|joanna|salli|kimberly|ivy\b|martha|stephanie|flo\b|sandy|shelley|grandma/i;
const MALE = /\bmale\b|daniel|alex\b|fred\b|rishi|ravi\b|arthur|oliver|aaron|\btom\b|guy\b|ryan|thomas|david|mark\b|george|prabhat|hemant|madhur|brian|matthew|justin|joey|russell|eddy|reed\b|rocko|ralph|grandpa/i;
/** Voices made for fun (robots, bubbles, singing) — never for a patient. */
const NOVELTY = /bad news|good news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|hysterical|deranged|princess|junior/i;

type Sex = "Male" | "Female";
const chosen = new Map<string, SpeechSynthesisVoice | null>();

/**
 * The best voice for this speaker: the case's accent and the speaker's sex if
 * the device has one; otherwise the right sex in another English accent (a
 * British-sounding wife beats a male one); the older voices for the elderly.
 */
function pickVoice(country: Country, sex: Sex, elderly: boolean): SpeechSynthesisVoice | null {
  const key = `${country}:${sex}:${elderly}`;
  if (chosen.has(key)) return chosen.get(key)!;
  const all = window.speechSynthesis.getVoices().filter((v) => !NOVELTY.test(v.name));
  if (!all.length) return null;
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const fits = (v: SpeechSynthesisVoice) => (sex === "Female" ? FEMALE.test(v.name) && !MALE.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name));
  const old = (v: SpeechSynthesisVoice) => /grandma|grandpa/i.test(v.name);
  const accent = all.filter((v) => lang(v).startsWith(ACCENT[country]));
  const english = all.filter((v) => lang(v).startsWith("en"));
  const order = [
    ...(elderly ? [accent.find((v) => fits(v) && old(v)), english.find((v) => fits(v) && old(v))] : []),
    accent.find((v) => fits(v) && !old(v) && v.localService),
    accent.find((v) => fits(v) && !old(v)),
    english.find((v) => fits(v) && !old(v) && lang(v).startsWith(country === "IN" ? "en-gb" : "en")),
    english.find((v) => fits(v) && !old(v)),
    accent.find((v) => !old(v)),
    english[0],
  ];
  const voice = order.find((v): v is SpeechSynthesisVoice => !!v) ?? null;
  chosen.set(key, voice);
  return voice;
}

/** Who the family member is, from the case's own words; otherwise the other sex from the patient. */
function attendantSex(state: CaseState): Sex {
  const text = `${state.briefing} ${state.messages.slice(0, 3).map((m) => m.text).join(" ")}`.toLowerCase();
  if (/\b(wife|mother|daughter|sister|aunt|girlfriend|her husband's wife)\b/.test(text)) return "Female";
  if (/\b(husband|son|father|brother|uncle|boyfriend|roommate|flatmate|young man)\b/.test(text)) return "Male";
  return state.patient.sex === "Female" ? "Male" : "Female";
}

/** Stage directions aren't read out; pauses become commas. */
const spoken = (text: string) =>
  text
    .replace(/\([^)]*\)/g, " ")
    .replace(/[…]+|\.{3}/g, ", ")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

function say(text: string, state: CaseState, role: "patient" | "attendant") {
  const words = spoken(text);
  if (!words) return;
  const sex: Sex = role === "patient" ? (state.patient.sex === "Female" ? "Female" : "Male") : attendantSex(state);
  const u = new SpeechSynthesisUtterance(words);
  const age = role === "patient" ? state.patient.age : 40;
  const voice = pickVoice(state.country ?? "IN", sex, age >= 70);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? ACCENT[state.country ?? "IN"];
  u.rate = age >= 65 ? 0.9 : age < 12 ? 1.05 : 0.98;
  u.pitch = age < 12 ? 1.35 : age >= 65 ? 0.88 : 1;
  window.speechSynthesis.speak(u);
}

/**
 * Reads new patient and family lines aloud, in order; a new turn interrupts
 * whatever is still being said. Turning voices on reads the latest line.
 */
export function usePatientVoices(state: CaseState, newIds: Set<string>, turn: number) {
  const on = useVoicesEnabled();
  const lastTurn = useRef(turn);

  // Voices load asynchronously in some browsers; forget early choices when they arrive.
  useEffect(() => {
    if (!voicesSupported()) return;
    const reset = () => chosen.clear();
    window.speechSynthesis.addEventListener?.("voiceschanged", reset);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", reset);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!on || !voicesSupported() || turn === lastTurn.current) return;
    lastTurn.current = turn;
    const lines = state.messages.filter((m) => newIds.has(m.id) && m.kind === "speech" && (m.role === "patient" || m.role === "attendant"));
    if (!lines.length) return;
    window.speechSynthesis.cancel();
    for (const m of lines) say(m.text, state, m.role as "patient" | "attendant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, on]);

  // Feedback when the player switches voices on: hear the latest thing said.
  useEffect(() => {
    if (!on || !announce || !voicesSupported()) return;
    announce = false;
    const last = [...state.messages].reverse().find((m) => m.kind === "speech" && (m.role === "patient" || m.role === "attendant"));
    if (last) {
      window.speechSynthesis.cancel();
      say(last.text, state, last.role as "patient" | "attendant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}
