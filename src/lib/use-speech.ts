"use client";

/**
 * Voice input via the browser's speech recognition (Chrome, Edge, Safari).
 * Transcripts are written into the composer — nothing is sent until the
 * player presses Enter. Indian English by default.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** The words so far, from the browser's results: one that extends the one before replaces it, and a shorter repeat is dropped. */
export function joinSpeech(results: readonly string[]): string {
  const parts: string[] = [];
  for (const t of results) {
    if (!t) continue;
    const prev = parts[parts.length - 1];
    const a = t.toLowerCase(), b = prev?.toLowerCase() ?? "";
    if (prev !== undefined && a.startsWith(b)) parts[parts.length - 1] = t;
    else if (prev !== undefined && b.startsWith(a)) continue;
    else parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => setSupported(!!ctor()), []);
  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      // Rebuilt from every result each time. Android Chrome repeats the words so far in each new result
      // ("diclofenac", "diclofenac 40", "diclofenac 40 mg") — a result that extends the one before replaces it.
      const heard = Array.from(e.results, (res) => (res[0]?.transcript ?? "").trim());
      const interim = Array.from(e.results).some((res) => !res.isFinal);
      cb.current(joinSpeech(heard), !interim);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone access was blocked." : e.error === "no-speech" ? null : "Voice input stopped.");
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    setError(null);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
