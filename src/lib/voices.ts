"use client";

/**
 * Patients and families speak aloud — the browser's own speech synthesis
 * (free and on-device), in an Indian, American or British accent to match
 * the case. Off until the player turns it on.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { Country } from "@/engine/countries";
import type { CaseState } from "@/engine/types";

import { toDevanagari } from "./devanagari";

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
  if (!on && voicesSupported()) {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }
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

const ACCENT: Record<Country, string> = { IN: "en-in", US: "en-us", UK: "en-gb", WW: "en" };
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
/** Neural voices ("Natural", "Online", Google's) sound far more human than the old ones: tried first. */
const NATURAL = /natural|online|neural|google|premium|enhanced/i;
const byQuality = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => Number(NATURAL.test(b.name)) - Number(NATURAL.test(a.name));

/** A Hindi voice for Hinglish lines — the speaker's sex if the device has one. */
function pickHindi(sex: Sex): SpeechSynthesisVoice | null {
  const key = `hi:${sex}`;
  if (chosen.has(key)) return chosen.get(key)!;
  const hindi = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("hi"))
    .sort(byQuality);
  const fits = (v: SpeechSynthesisVoice) => (sex === "Female" ? FEMALE.test(v.name) && !MALE.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name));
  const voice = hindi.find(fits) ?? hindi[0] ?? null;
  chosen.set(key, voice);
  return voice;
}

function pickVoice(country: Country, sex: Sex, elderly: boolean): SpeechSynthesisVoice | null {
  const key = `${country}:${sex}:${elderly}`;
  if (chosen.has(key)) return chosen.get(key)!;
  const all = window.speechSynthesis
    .getVoices()
    .filter((v) => !NOVELTY.test(v.name))
    .sort(byQuality);
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
    // Emojis and symbols are never read out ("smiling face").
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[…]+|\.{3}/g, ", ")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * How it's said, from how the patient is and what they say: in pain or fear — slower, strained, with
 * pauses; frightened or pleading — quicker and higher; better — calm and warm; very ill — slow and low.
 */
function emotion(text: string, state: CaseState, role: "patient" | "attendant"): { rate: number; pitch: number } {
  const t = text.toLowerCase();
  const status = state.patientStatus;
  if (role === "patient" && (status === "critical" || status === "deteriorating")) return { rate: 0.82, pitch: 0.92 };
  if (/\b(please|help|jaldi|bachao|kuch karo|scared|dar lag)\b|!/.test(t)) return { rate: 1.08, pitch: 1.1 };
  if (/\b(pain|hurts?|dard|aah|aa+h|ouch|burning|jalan|can'?t breathe|saans)\b|…|\.{3}/.test(t)) return { rate: 0.86, pitch: 1.04 };
  if (/\b(better|relief|thank|aaram|behtar|shukriya|theek)\b/.test(t)) return { rate: 0.96, pitch: 1.02 };
  return { rate: 0.98, pitch: 1 };
}

const speaking = { now: false, listeners: new Set<() => void>() };
const setSpeaking = (on: boolean) => {
  if (speaking.now === on) return;
  speaking.now = on;
  speaking.listeners.forEach((l) => l());
};
/** Whether a patient or relative is speaking right now (phone voice or natural voice). */
export const isSpeaking = () => speaking.now || (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking);

/* Natural voice (OpenAI text-to-speech, for Talk live): lines are fetched and played in order. */
let natural = false;
export const setNaturalVoice = (on: boolean) => {
  natural = on;
  if (!on) {
    queue.length = 0;
    player?.pause();
    setSpeaking(false);
  }
};
const queue: Promise<Blob | null>[] = [];
let player: HTMLAudioElement | null = null;
let playing = false;
function moodOf(text: string, state: CaseState, role: "patient" | "attendant"): "calm" | "pain" | "scared" | "ill" | "better" {
  const t = text.toLowerCase();
  if (role === "patient" && (state.patientStatus === "critical" || state.patientStatus === "deteriorating")) return "ill";
  if (/\b(please|help|jaldi|bachao|scared|dar lag)\b|!/.test(t)) return "scared";
  if (/\b(pain|hurts?|dard|ouch|burning|jalan|can'?t breathe|saans)\b/.test(t)) return "pain";
  if (/\b(better|relief|thank|aaram|behtar|shukriya)\b/.test(t)) return "better";
  return "calm";
}
async function playNext() {
  if (playing) return;
  const next = queue.shift();
  if (!next) return setSpeaking(false);
  playing = true;
  setSpeaking(true);
  const blob = await next.catch(() => null);
  if (!blob || !natural) {
    playing = false;
    return void playNext();
  }
  player ??= new Audio();
  player.src = URL.createObjectURL(blob);
  player.onended = player.onerror = () => {
    playing = false;
    void playNext();
  };
  void player.play().catch(() => {
    playing = false;
    void playNext();
  });
}
function sayNatural(text: string, state: CaseState, role: "patient" | "attendant"): boolean {
  const words = spoken(text);
  if (!words) return true;
  const sex = role === "patient" ? (state.patient.sex === "Female" ? "Female" : "Male") : attendantSex(state);
  setSpeaking(true);
  queue.push(
    fetch("/api/cases/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: words, sex, age: role === "patient" ? state.patient.age : 40, country: state.country ?? "IN", mood: moodOf(text, state, role), hinglish: state.lang === "hinglish" }) })
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null),
  );
  void playNext();
  return true;
}

/** Whether a patient or relative is speaking right now — the voice button shows it. */
export function useSpeaking(): boolean {
  return useSyncExternalStore(
    (l) => {
      speaking.listeners.add(l);
      return () => speaking.listeners.delete(l);
    },
    () => speaking.now,
    () => false,
  );
}

function say(text: string, state: CaseState, role: "patient" | "attendant") {
  if (natural && sayNatural(text, state, role)) return;
  const words = spoken(text);
  if (!words) return;
  const sex: Sex = role === "patient" ? (state.patient.sex === "Female" ? "Female" : "Male") : attendantSex(state);
  const age = role === "patient" ? state.patient.age : 40;
  // Hinglish is read by a Hindi voice, in Devanagari — a real local accent. Without one, an Indian-English voice.
  const hindi = state.lang === "hinglish" ? pickHindi(sex) : null;
  const u = new SpeechSynthesisUtterance(hindi ? toDevanagari(words) : words);
  const voice = hindi ?? pickVoice(state.country ?? "IN", sex, age >= 70);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? (hindi ? "hi-IN" : ACCENT[state.country ?? "IN"]);
  const feel = emotion(text, state, role);
  u.rate = feel.rate * (age >= 65 ? 0.92 : age < 12 ? 1.06 : 1);
  u.pitch = Math.min(2, feel.pitch * (age < 12 ? 1.35 : age >= 65 ? 0.88 : 1));
  u.onstart = () => setSpeaking(true);
  u.onend = u.onerror = () => setSpeaking(window.speechSynthesis.speaking && window.speechSynthesis.pending);
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
