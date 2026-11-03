"use client";

/**
 * Rain and a quiet library room, made on the phone with the Web Audio API: there are no recordings of either among the
 * focus media, and this way they work offline with nothing to download.
 */
export type SynthSound = "rain" | "library";

let ctx: AudioContext | null = null;
let current: { source: AudioBufferSourceNode; gain: GainNode; sound: SynthSound } | null = null;

const LEVEL: Record<SynthSound, number> = { rain: 0.5, library: 0.9 };

/** Eight seconds of noise: white for rain; deep brown for the low hum of a quiet room. */
function noise(c: AudioContext, sound: SynthSound) {
  const buffer = c.createBuffer(1, c.sampleRate * 8, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (sound === "rain") data[i] = white * 0.5;
    else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

export function stopAmbient() {
  try { current?.source.stop(); } catch {}
  current?.source.disconnect();
  current?.gain.disconnect();
  current = null;
}

export function playAmbient(sound: SynthSound, volume: number) {
  try {
    if (current?.sound === sound) {
      current.gain.gain.value = volume * LEVEL[sound];
      void ctx?.resume();
      return;
    }
    stopAmbient();
    ctx ??= new AudioContext();
    void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx, sound);
    source.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = sound === "rain" ? 6500 : 320;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = sound === "rain" ? 700 : 40;
    const gain = ctx.createGain();
    gain.gain.value = volume * LEVEL[sound];
    source.connect(low).connect(high).connect(gain).connect(ctx.destination);
    source.start();
    current = { source, gain, sound };
  } catch {}
}
