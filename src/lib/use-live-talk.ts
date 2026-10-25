"use client";

/**
 * Live talk: a hands-free conversation with the patient, like a voice call — free, on the phone's own speech service.
 * The microphone listens; a pause of about a second sends what was said; the patient's reply is spoken aloud (the
 * patient voices); the microphone opens again once they've finished. Nothing extra is paid for.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { setVoicesEnabled } from "./voices";

type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start: () => void; stop: () => void; abort: () => void };
const Ctor = () => (typeof window === "undefined" ? undefined : ((window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition));

export function useLiveTalk(onSend: (text: string) => Promise<boolean> | void, busy: boolean) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState("");
  const rec = useRef<Rec | null>(null);
  const live = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const send = useRef(onSend);
  send.current = onSend;

  useEffect(() => setSupported(!!Ctor() && typeof speechSynthesis !== "undefined"), []);

  const listen = useCallback(() => {
    const C = Ctor();
    if (!C || rec.current || !live.current) return;
    // Wait while a reply is coming or the patient is still talking.
    if (busyRef.current || speechSynthesis.speaking) {
      window.setTimeout(listen, 400);
      return;
    }
    const r = new C();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    let text = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) text += res[0]?.transcript ?? "";
        else interim += res[0]?.transcript ?? "";
      }
      setHeard((text + interim).trim());
      window.clearTimeout(timer.current);
      // A pause after something final: that's the question — send it.
      if (text.trim() && !interim) {
        timer.current = window.setTimeout(() => {
          const said = text.trim();
          text = "";
          setHeard("");
          r.stop();
          void send.current(said);
        }, 900);
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") {
        live.current = false;
        setOn(false);
      }
    };
    r.onend = () => {
      rec.current = null;
      if (live.current) window.setTimeout(listen, 300);
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      rec.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (live.current) {
      live.current = false;
      setOn(false);
      setHeard("");
      rec.current?.abort();
      rec.current = null;
      return;
    }
    setVoicesEnabled(true);
    live.current = true;
    setOn(true);
    listen();
  }, [listen]);

  useEffect(() => () => {
    live.current = false;
    rec.current?.abort();
  }, []);

  return { supported, on, heard, toggle };
}
