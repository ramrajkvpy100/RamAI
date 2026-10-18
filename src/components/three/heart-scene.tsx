"use client";

/**
 * An anatomical heart — ventricles, atria and auricles, the great vessels with
 * their open ends, coronary arteries and veins in their fat — lit like wet
 * tissue in a studio and beating: the ventricles squeeze, the atria contract
 * just before. The model is built ahead of time (heart-model, scripts/
 * build-heart.mjs) and loaded as a small file; three.js loads lazily,
 * rendering pauses off-screen, reduced motion gets a still frame, and without
 * WebGL a soft glow stands in.
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/** One heartbeat, ~70 a minute: the atria kick, then the ventricles squeeze and relax. */
function cardiac(t: number) {
  const ph = (t % 0.86) / 0.86;
  const s = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const systole = s(0.02, 0.13, ph) * (1 - s(0.3, 0.52, ph));
  const atrial = Math.exp(-(((ph - 0.9) / 0.045) ** 2)) + Math.exp(-(((ph + 0.1) / 0.045) ** 2));
  return { systole, atrial };
}

/** Coronary arteries and cardiac veins (sRGB). */
const VESSEL_HEX = { artery: 0xd04a74, vein: 0x6a5ee0 } as const;

/** The organs the site shows, and how each sits and moves. */
const ORGANS = {
  heart: { scale: 1.42, turn: [0.06, -0.3, 0.02], sway: 0.5, lean: -0.22 },
  // The real brain (x: the patient's left, z: forwards): turned to show the left hemisphere's lateral surface, frontal lobe to the left.
  brain: { scale: 1.32, turn: [0.16, -1.3, 0], sway: 0.55, lean: -0.45 },
  lungs: { scale: 1.3, turn: [0.04, 0, 0], sway: 0.32, lean: 0 },
} as const;
export type Organ = keyof typeof ORGANS;

/** Breathing, ~13 a minute: a slow rise, a softer fall. */
const breath = (t: number) => {
  const ph = (t % 4.6) / 4.6;
  return ph < 0.42 ? 0.5 - 0.5 * Math.cos((ph / 0.42) * Math.PI) : 0.5 + 0.5 * Math.cos(((ph - 0.42) / 0.58) * Math.PI);
};

export function HeartScene(props: { className?: string; density?: "hero" | "compact"; tone?: "auto" | "dark"; bare?: boolean }) {
  return <OrganScene organ="heart" {...props} />;
}

/** The heart beating, the lungs breathing, or the brain turning slowly — the same studio, the same wet tissue. */
export function OrganScene({ organ = "heart", className, density = "hero", tone = "auto", bare = false }: { organ?: Organ; className?: string; density?: "hero" | "compact"; /** "dark" when drawn on an always-dark surface. */ tone?: "auto" | "dark"; /** The organ alone — no glow, shadow or dust (for capturing it as a picture). */ bare?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  /** Until the 3D organ is drawn, the soft glow holds its place. */
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    const abort = new AbortController();

    (async () => {
      const probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") ?? probe.getContext("webgl")) || typeof DecompressionStream === "undefined") {
        setFallback(true);
        return;
      }
      // The organ (three.js and a model of a few hundred KB) waits until the page itself has loaded and gone quiet, so it never slows first paint.
      // On phones and small machines it waits for the visitor to touch, scroll or type — a page only looked at never pays for it.
      const phone = window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
      await new Promise<void>((resolve) => {
        const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
        const go = () => (idle ? idle(() => resolve(), { timeout: 2000 }) : window.setTimeout(resolve, 300));
        if (phone) {
          const events = ["pointerdown", "touchstart", "scroll", "keydown", "wheel"] as const;
          const once = () => {
            events.forEach((e) => window.removeEventListener(e, once));
            go();
          };
          events.forEach((e) => window.addEventListener(e, once, { once: true, passive: true }));
          abort.signal.addEventListener("abort", () => events.forEach((e) => window.removeEventListener(e, once)));
          return;
        }
        if (document.readyState === "complete") go();
        else window.addEventListener("load", go, { once: true });
      });
      if (disposed) return;
      // The detailed model for large screens; a lighter one for phones and small cards.
      const detailed = density === "hero" && Math.max(window.innerWidth, window.innerHeight) >= 900;
      const [THREE, { loadHeart }, { studioScene, wetTissue }] = await Promise.all([import("three"), import("./heart-asset"), import("./heart-material")]);
      const asset = await loadHeart(`/models/${organ}-${detailed ? "hd" : "sd"}.bin.gz`, abort.signal);
      const pose = ORGANS[organ];
      if (disposed) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const canvas = document.createElement("canvas");
      // Smooth edges everywhere: the outline of a glossy organ against a light page shows every jagged pixel.
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.25 : 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const studio = studioScene(THREE);
      const env = pmrem.fromScene(studio, 0.02).texture;
      scene.environment = env;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.05, 7.6);

      const isDark = () => tone === "dark" || document.documentElement.getAttribute("data-theme") === "dark";

      /* The heart --------------------------------------------------------- */
      const { material, uniforms } = wetTissue(THREE, { bump: detailed ? 0.012 : 0.009, finish: organ === "heart" ? "lacquer" : "moist" });
      const geos: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const body = new THREE.BufferGeometry();
      body.setAttribute("position", new THREE.BufferAttribute(asset.positions, 3));
      body.setAttribute("color", new THREE.BufferAttribute(asset.colors, 3));
      body.setAttribute("aAttr", new THREE.BufferAttribute(asset.attrs, 4, true));
      body.setIndex(new THREE.BufferAttribute(asset.indices, 1));
      body.computeVertexNormals();
      geos.push(body);
      const heart = new THREE.Group();
      heart.add(new THREE.Mesh(body, material));

      // Coronary arteries and cardiac veins: tubes that taper to a point, lying in the fat.
      const tint = { artery: new THREE.Color(VESSEL_HEX.artery), vein: new THREE.Color(VESSEL_HEX.vein) };
      for (const v of asset.vessels) {
        const count = v.points.length / 3;
        const sides = detailed ? 10 : 8;
        const pos = new Float32Array(count * sides * 3);
        const nrm = new Float32Array(count * sides * 3);
        const col = new Float32Array(count * sides * 3);
        const att = new Uint8Array(count * sides * 4);
        const P = (i: number) => new THREE.Vector3(v.points[i * 3], v.points[i * 3 + 1], v.points[i * 3 + 2]);
        let normal = new THREE.Vector3();
        for (let i = 0; i < count; i++) {
          const tangent = P(Math.min(count - 1, i + 1)).sub(P(Math.max(0, i - 1))).normalize();
          if (i === 0) normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
          else normal.sub(tangent.clone().multiplyScalar(normal.dot(tangent))).normalize();
          const binormal = tangent.clone().cross(normal);
          const left = count - 1 - i;
          const r = v.radii[i]! * Math.sqrt(Math.min(1, left / 3 + 0.05));
          const c = P(i);
          const shade = v.attrs[i * 3]!;
          for (let s = 0; s < sides; s++) {
            const a = (s / sides) * Math.PI * 2;
            const n = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a));
            const k = (i * sides + s) * 3;
            pos[k] = c.x + n.x * r;
            pos[k + 1] = c.y + n.y * r;
            pos[k + 2] = c.z + n.z * r;
            nrm[k] = n.x;
            nrm[k + 1] = n.y;
            nrm[k + 2] = n.z;
            col[k] = tint[v.kind].r;
            col[k + 1] = tint[v.kind].g;
            col[k + 2] = tint[v.kind].b;
            const q = (i * sides + s) * 4;
            att[q] = Math.round(shade * 255);
            att[q + 2] = Math.round(v.attrs[i * 3 + 1]! * 255);
            att[q + 3] = Math.round(v.attrs[i * 3 + 2]! * 255);
          }
        }
        const idx: number[] = [];
        for (let i = 0; i < count - 1; i++)
          for (let s = 0; s < sides; s++) {
            const a = i * sides + s, b = i * sides + ((s + 1) % sides), c = (i + 1) * sides + s, d = (i + 1) * sides + ((s + 1) % sides);
            idx.push(a, b, c, b, d, c);
          }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        g.setAttribute("aAttr", new THREE.BufferAttribute(att, 4, true));
        g.setIndex(idx);
        geos.push(g);
        heart.add(new THREE.Mesh(g, material));
      }
      heart.position.set(-asset.center[0], -asset.center[1], -asset.center[2]);
      const pivot = new THREE.Group();
      pivot.add(heart);
      pivot.scale.setScalar(pose.scale);

      /* Light ---------------------------------------------------------------- */
      const key = new THREE.DirectionalLight(0xfff0ea, 2.2);
      key.position.set(-3, 4, 5);
      // Brand-coloured rims: violet from behind right, cyan from behind left.
      const rim = new THREE.DirectionalLight(0xb99cff, 2.6);
      rim.position.set(4, 1.5, -4);
      const rim2 = new THREE.DirectionalLight(0x7fdcff, 1.8);
      rim2.position.set(-4.5, 0.5, -3);
      const under = new THREE.DirectionalLight(0xffc6d0, 0.5);
      under.position.set(2, -4, 3);
      scene.add(key, rim, rim2, under);

      /* A soft glow behind, and drifting dust for depth ---------------------- */
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 128;
      const g2 = glowCanvas.getContext("2d")!;
      const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.32)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g2.fillStyle = grad;
      g2.fillRect(0, 0, 128, 128);
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(5.4);
      glow.position.set(0, 0, -1.8);

      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = shadowCanvas.height = 64;
      const s2 = shadowCanvas.getContext("2d")!;
      const sg = s2.createRadialGradient(32, 32, 0, 32, 32, 32);
      sg.addColorStop(0, "rgba(40,20,60,0.55)");
      sg.addColorStop(1, "rgba(40,20,60,0)");
      s2.fillStyle = sg;
      s2.fillRect(0, 0, 64, 64);
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowMat = new THREE.SpriteMaterial({ map: shadowTex, transparent: true, depthWrite: false });
      const shadow = new THREE.Sprite(shadowMat);
      shadow.scale.set(2.4, 0.42, 1);
      shadow.position.set(0.15, -1.92, -0.6);

      const dustCount = detailed ? 360 : 180;
      const dust = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        const r = 2.6 + Math.random() * 2.4;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(Math.random() * 2 - 1);
        dust[i * 3] = r * Math.sin(p) * Math.cos(t);
        dust[i * 3 + 1] = r * Math.cos(p) * 0.7;
        dust[i * 3 + 2] = r * Math.sin(p) * Math.sin(t) - 1;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      const dustMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.02, transparent: true, opacity: 0.45, depthWrite: false });
      const dustPts = new THREE.Points(dustGeo, dustMat);
      if (bare) scene.add(pivot);
      else scene.add(glow, shadow, dustPts, pivot);

      let dark = isDark();
      const applyTheme = () => {
        dark = isDark();
        renderer.toneMappingExposure = dark ? 0.98 : 1.08;
        // Softer colour than a photo would have, so it sits with the page rather than shouting over it.
        uniforms.uSaturation.value = dark ? 0.88 : 0.8;
        scene.environmentIntensity = dark ? 0.55 : 0.85;
        rim.intensity = dark ? 2.8 : 1.4;
        rim2.intensity = dark ? 2 : 0.9;
        key.intensity = dark ? 2.2 : 2.0;
        glowMat.color.set(dark ? 0xc04cff : 0xe7a6ff);
        shadowMat.opacity = dark ? 0 : 0.55;
        glowMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        dustMat.color.set(dark ? 0x93c5fd : 0x3b82f6);
        dustMat.opacity = dark ? 0.45 : 0.22;
        dustMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        glowMat.needsUpdate = true;
        dustMat.needsUpdate = true;
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
        // Narrow canvases step the camera back so the whole heart, vessels and all, stays in frame.
        camera.position.z = width / height < 0.9 ? 7.6 / Math.max(0.55, width / height / 0.9) : 7.6;
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
      // Turned to show it best: the heart's apex, arch and coronaries; the brain's lateral surface; the lungs from the front.
      pivot.rotation.set(pose.turn[0], pose.turn[1], pose.turn[2]);
      const render = () => {
        const t = clock.getElapsedTime();
        const beat = reduce || organ !== "heart" ? { systole: 0, atrial: 0 } : cardiac(t);
        uniforms.uSystole.value = beat.systole;
        uniforms.uAtrial.value = beat.atrial;
        if (organ === "lungs" && !reduce) pivot.scale.setScalar(pose.scale * (1 + 0.028 * breath(t)));
        pivot.rotation.y += ((reduce ? pose.turn[1] : Math.sin(t * 0.28) * pose.sway + pose.lean + pointer.x * 0.5) - pivot.rotation.y) * 0.05;
        pivot.rotation.x += ((reduce ? 0.06 : pointer.y * 0.2 + 0.06) - pivot.rotation.x) * 0.05;
        glowMat.opacity = (dark ? 0.28 : 0.24) + beat.systole * 0.06;
        dustPts.rotation.y = -t * 0.03;
        renderer.render(scene, camera);
      };

      // Adapt once: a device that can't hold a smooth frame rate gets fewer pixels and no dust.
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
        dustPts.visible = false;
      };
      // Phones draw 30 frames a second — smooth for a heartbeat, half the work.
      const minGap = phone ? 1000 / 30 - 2 : 0;
      let drewAt = 0;
      const loop = (now: number) => {
        raf = 0;
        if (!visible || document.hidden) return;
        if (now - drewAt >= minGap) {
          drewAt = now;
          render();
          adapt(now);
        }
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
      requestAnimationFrame(() => {
        canvas.style.opacity = "1";
        setDrawn(true);
      });

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        themeObserver.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        geos.forEach((g) => g.dispose());
        material.dispose();
        glowTex.dispose();
        glowMat.dispose();
        shadowTex.dispose();
        shadowMat.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        env.dispose();
        pmrem.dispose();
        studio.traverse((o) => {
          const m = o as InstanceType<typeof THREE.Mesh>;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as InstanceType<typeof THREE.Material>).dispose();
          }
        });
        renderer.dispose();
        canvas.remove();
      };
    })().catch(() => !disposed && setFallback(true));

    return () => {
      disposed = true;
      abort.abort();
      cleanup();
    };
  }, [organ, density, tone, bare]);

  return (
    // Callers position the scene (usually `absolute …`); default to `relative` only when they don't.
    <div ref={host} aria-hidden className={className && /\b(absolute|fixed|relative|sticky)\b/.test(className) ? className : cn("relative", className)}>
      {(fallback || (!drawn && !bare)) && <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgb(244_63_94/0.45),rgb(139_92_246/0.2)_45%,transparent_70%)] blur-2xl" />}
      {/* The brain and lungs are real anatomy (BodyParts3D, CC BY-SA 2.1 JP): credited where they're shown. Full credit on /about. */}
      {organ !== "heart" && !bare && <span className="absolute right-2 bottom-1 text-[8.5px] leading-none text-white/35">BodyParts3D © DBCLS · CC BY-SA</span>}
    </div>
  );
}
