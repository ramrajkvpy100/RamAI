"use client";

/**
 * Holographic heart — a point cloud sampled on Taubin's heart surface
 *   (x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0
 * beating with a lub-dub rhythm inside an ECG halo. three.js is loaded lazily,
 * rendering pauses off-screen, reduced motion renders a single still frame,
 * and browsers without WebGL get a static gradient instead.
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uBeat;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 color;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position * (1.0 + uBeat * 0.075);
    p += normalize(position + 0.0001) * sin(uTime * 1.7 + aSeed * 6.2831) * 0.012;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.9) * (7.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = color;
    vAlpha = 0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 12.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  }
`;

const heartF = (x: number, y: number, z: number) => {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
};

/** Point on the heart surface along a ray from the centre. */
function surfaceAlong(dx: number, dy: number, dz: number): number {
  let lo = 0;
  let hi = 0;
  for (let r = 0.02; r < 2.4; r += 0.02) {
    if (heartF(dx * r, dy * r, dz * r) > 0) {
      hi = r;
      break;
    }
    lo = r;
  }
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (heartF(dx * mid, dy * mid, dz * mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Lub-dub at ~72 bpm. */
function beat(t: number) {
  const ph = (t % 0.83) / 0.83;
  return Math.exp(-(((ph - 0.04) / 0.045) ** 2)) + 0.62 * Math.exp(-(((ph - 0.25) / 0.05) ** 2));
}

export function HeartScene({ className, density = "hero", tone = "auto" }: { className?: string; density?: "hero" | "compact"; /** "dark" when drawn on an always-dark surface. */ tone?: "auto" | "dark" }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) {
        setFallback(true);
        return;
      }

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Multisampling costs a lot at high pixel ratios and barely shows on points there.
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 0.15, 7.2);

      const isDark = () => tone === "dark" || document.documentElement.getAttribute("data-theme") === "dark";

      /* Heart point cloud ------------------------------------------------ */
      const count = density === "hero" ? 9000 : 5200;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const cBlue = new THREE.Color("#3b82f6");
      const cCyan = new THREE.Color("#22d3ee");
      const cViolet = new THREE.Color("#8b5cf6");
      const tmp = new THREE.Color();
      for (let i = 0; i < count; i++) {
        // Random direction (heart space: z is up).
        const u = Math.random() * 2 - 1;
        const phi = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const dx = s * Math.cos(phi);
        const dy = s * Math.sin(phi);
        const dz = u;
        const surface = surfaceAlong(dx, dy, dz);
        const interior = Math.random() < 0.14;
        const r = interior ? surface * Math.cbrt(Math.random()) : surface * (0.965 + Math.random() * 0.035);
        const x = dx * r;
        const y = dy * r;
        const z = dz * r;
        // Heart space → three space (y up), scaled.
        positions[i * 3] = x * 1.25;
        positions[i * 3 + 1] = z * 1.25 + 0.12;
        positions[i * 3 + 2] = y * 1.25;
        const h = (z + 1.1) / 2.3;
        tmp.copy(cCyan).lerp(cBlue, Math.min(1, h * 1.3)).lerp(cViolet, Math.max(0, h - 0.55) * 1.6);
        const bright = interior ? 0.55 : 0.85 + Math.random() * 0.25;
        colors[i * 3] = tmp.r * bright;
        colors[i * 3 + 1] = tmp.g * bright;
        colors[i * 3 + 2] = tmp.b * bright;
        seeds[i] = Math.random();
      }
      const heartGeo = new THREE.BufferGeometry();
      heartGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      heartGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      heartGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      const uniforms = {
        uTime: { value: 0 },
        uBeat: { value: 0 },
        uSize: { value: density === "hero" ? 2.6 : 2.3 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uOpacity: { value: 1 },
      };
      const heartMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
      const heart = new THREE.Points(heartGeo, heartMat);

      /* ECG halo --------------------------------------------------------- */
      const haloPts: number[] = [];
      const N = 720;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const ph = ((a / (Math.PI * 2)) * 3) % 1;
        const spike =
          0.07 * Math.exp(-(((ph - 0.3) / 0.025) ** 2)) + 0.32 * Math.exp(-(((ph - 0.4) / 0.008) ** 2)) - 0.1 * Math.exp(-(((ph - 0.42) / 0.01) ** 2)) + 0.1 * Math.exp(-(((ph - 0.55) / 0.04) ** 2));
        const R = 2.55;
        haloPts.push(Math.cos(a) * R, spike, Math.sin(a) * R);
      }
      const haloGeo = new THREE.BufferGeometry();
      haloGeo.setAttribute("position", new THREE.Float32BufferAttribute(haloPts, 3));
      const haloMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 });
      const halo = new THREE.Line(haloGeo, haloMat);
      halo.rotation.x = 0.32;
      halo.position.y = -0.15;

      const ringGeo = new THREE.RingGeometry(3.1, 3.115, 160);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + 0.42;
      ring.rotation.y = -0.3;

      /* Dust --------------------------------------------------------------- */
      const dustCount = density === "hero" ? 700 : 380;
      const dust = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        const r = 3 + Math.random() * 2.6;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(Math.random() * 2 - 1);
        dust[i * 3] = r * Math.sin(p) * Math.cos(t);
        dust[i * 3 + 1] = r * Math.cos(p) * 0.7;
        dust[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      const dustMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.022, transparent: true, opacity: 0.6, depthWrite: false });
      const dustPts = new THREE.Points(dustGeo, dustMat);

      const group = new THREE.Group();
      group.add(heart, halo, ring, dustPts);
      scene.add(group);

      const applyTheme = () => {
        const dark = isDark();
        const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        heartMat.blending = blending;
        dustMat.blending = blending;
        haloMat.blending = blending;
        uniforms.uOpacity.value = dark ? 1 : 0.92;
        haloMat.color.set(dark ? 0x22d3ee : 0x0891b2);
        ringMat.color.set(dark ? 0x8b5cf6 : 0x7c3aed);
        dustMat.color.set(dark ? 0x93c5fd : 0x3b82f6);
        dustMat.opacity = dark ? 0.6 : 0.35;
        heartMat.needsUpdate = true;
        dustMat.needsUpdate = true;
        haloMat.needsUpdate = true;
      };
      applyTheme();
      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      /* Sizing, pointer, visibility ---------------------------------------- */
      const resize = () => {
        const { width, height } = el.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width / height < 0.9 ? 8.6 : 7.2;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = e.clientX / window.innerWidth - 0.5;
        pointer.y = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible && !reduce) start();
      });
      io.observe(el);

      const clock = new THREE.Clock();
      let raf = 0;
      const render = () => {
        const t = clock.getElapsedTime();
        uniforms.uTime.value = t;
        uniforms.uBeat.value = reduce ? 0.2 : beat(t);
        group.rotation.y += ((reduce ? 0.35 : Math.sin(t * 0.35) * 0.55 + pointer.x * 0.7) - group.rotation.y) * 0.05;
        group.rotation.x += ((reduce ? 0.06 : pointer.y * 0.28 + 0.06) - group.rotation.x) * 0.05;
        halo.rotation.y = t * 0.25;
        ring.rotation.z = t * 0.08;
        dustPts.rotation.y = -t * 0.03;
        renderer.render(scene, camera);
      };
      // Adapt once: a device that can't hold a smooth frame rate gets fewer pixels and particles.
      let frames = 0;
      let slow = 0;
      let lastFrame = 0;
      let adapted = false;
      const adapt = (now: number) => {
        const dt = now - lastFrame;
        lastFrame = now;
        if (adapted || ++frames < 10 || dt <= 0 || dt > 250) return;
        if (dt > 22) slow += 1;
        if (frames < 110) return;
        adapted = true;
        if (slow < 45) return;
        renderer.setPixelRatio(1);
        resize();
        heartGeo.setDrawRange(0, Math.floor(count * 0.6));
        dustGeo.setDrawRange(0, Math.floor(dustCount * 0.5));
      };
      const loop = (now: number) => {
        raf = 0;
        if (!visible || document.hidden) return;
        render();
        adapt(now);
        raf = requestAnimationFrame(loop);
      };
      const start = () => {
        if (!raf) raf = requestAnimationFrame(loop);
      };
      const onVisibility = () => !document.hidden && !reduce && start();
      document.addEventListener("visibilitychange", onVisibility);
      // Draw one frame straight away (also covers reduced motion and hidden tabs), then animate.
      render();
      if (!reduce) start();

      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 1s ease";
      requestAnimationFrame(() => (canvas.style.opacity = "1"));

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        themeObserver.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        heartGeo.dispose();
        heartMat.dispose();
        haloGeo.dispose();
        haloMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })().catch(() => setFallback(true));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [density, tone]);

  return (
    // Callers position the scene (usually `absolute …`); default to `relative` only when they don't.
    <div ref={host} aria-hidden className={className && /\b(absolute|fixed|relative|sticky)\b/.test(className) ? className : cn("relative", className)}>
      {fallback && <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgb(59_130_246/0.55),rgb(139_92_246/0.25)_45%,transparent_70%)] blur-2xl" />}
    </div>
  );
}
