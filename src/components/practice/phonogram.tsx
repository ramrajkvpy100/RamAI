"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";

/**
 * While the doctor is answering: a plain moving equalizer that says nothing about the sound, so it's the ears that decide.
 * Once answered: its real waveform scrolling past a playhead, drawn from the very samples played and timed from the audio's own clock.
 */
export function Phonogram({ samples, rate, audio, playing, revealed }: { samples: Float32Array; rate: number; audio: RefObject<HTMLAudioElement | null>; playing: boolean; revealed: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
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
    if (!revealed) return;
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
      if (playing && !reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [audio, envelope, playing, rate, revealed, step]);

  return (
    <div aria-hidden className="h-12">
      {revealed ? (
        <canvas ref={canvas} className="animate-fade h-full w-full rounded-lg text-accent-text" />
      ) : (
        <div className="flex h-full items-center justify-center gap-[3px]">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className={playing ? "eq-bar" : "eq-bar eq-still"} style={{ animationDelay: `${((i * 7) % 11) * -90}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}
