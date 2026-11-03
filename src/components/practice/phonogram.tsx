"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";

/**
 * The sound as it's heard: its real waveform scrolling past a playhead, and a stethoscope diaphragm that swells with it.
 * Drawn from the very samples being played and timed from the audio's own clock, so picture and sound stay together.
 */
export function Phonogram({ samples, rate, audio, playing }: { samples: Float32Array; rate: number; audio: RefObject<HTMLAudioElement | null>; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const diaphragm = useRef<HTMLSpanElement>(null);
  // Loudness every 15 ms: enough to show each beat, and light to draw.
  const step = Math.round(rate * 0.015);
  const envelope = useMemo(() => {
    const out = new Float32Array(Math.ceil(samples.length / step));
    let top = 0.0001;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.abs(samples[i]!);
      const k = Math.floor(i / step);
      if (v > out[k]!) out[k] = v;
      if (v > top) top = v;
    }
    return out.map((v) => v / top);
  }, [samples, step]);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colour = getComputedStyle(el).color;
    let raf = 0;
    const secondsShown = 3;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth, h = el.clientHeight;
      if (el.width !== Math.round(w * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const now = audio.current?.currentTime ?? 0;
      const head = w * 0.3;
      const pxPerPoint = (w / secondsShown) * ((step / rate));
      const at = (now * rate) / step;
      g.fillStyle = colour;
      for (let x = 0; x < w; x += Math.max(2, pxPerPoint)) {
        const k = Math.floor(at + (x - head) / pxPerPoint);
        const v = k >= 0 && envelope.length ? envelope[k % envelope.length]! : 0;
        const bar = Math.max(1, v * h * 0.92);
        g.globalAlpha = x <= head ? 1 : 0.32;
        g.fillRect(x, (h - bar) / 2, Math.max(1, pxPerPoint - 1), bar);
      }
      g.globalAlpha = 0.9;
      g.fillRect(head, 0, 1.5, h);
      const loudNow = envelope[Math.floor(at) % Math.max(1, envelope.length)] ?? 0;
      if (diaphragm.current) {
        diaphragm.current.style.transform = `scale(${1 + (playing ? loudNow : 0) * 0.45})`;
        diaphragm.current.style.opacity = String(playing ? 0.35 + loudNow * 0.65 : 0.3);
      }
      if (playing && !reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [audio, envelope, playing, rate, step]);

  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <span ref={diaphragm} className="absolute inset-0 rounded-full bg-accent-soft ring-2 ring-accent-line will-change-transform" />
        <span className="relative h-4 w-4 rounded-full bg-accent" />
      </span>
      <canvas ref={canvas} className="h-12 min-w-0 flex-1 rounded-lg text-accent-text" />
    </div>
  );
}
