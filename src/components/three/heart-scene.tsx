"use client";

/**
 * An anatomical heart — ventricles and atria, the great vessels, and the
 * coronary arteries in their fat — built from maths in the browser (see
 * heart-model), lit like wet tissue and beating lub-dub. three.js loads
 * lazily, the model builds in slices so the page never stalls, rendering
 * pauses off-screen, reduced motion gets a single still frame, and without
 * WebGL a soft glow stands in.
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/** Lub-dub at ~72 bpm. */
function beat(t: number) {
  const ph = (t % 0.83) / 0.83;
  return Math.exp(-(((ph - 0.04) / 0.045) ** 2)) + 0.62 * Math.exp(-(((ph - 0.25) / 0.05) ** 2));
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

export function HeartScene({ className, density = "hero", tone = "auto" }: { className?: string; density?: "hero" | "compact"; /** "dark" when drawn on an always-dark surface. */ tone?: "auto" | "dark" }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) {
        setFallback(true);
        return;
      }
      const [THREE, { RoomEnvironment }, { buildHeartModel, VESSEL_HEX }] = await Promise.all([import("three"), import("three/examples/jsm/environments/RoomEnvironment.js"), import("./heart-model")]);
      if (disposed) return;
      const model = await buildHeartModel(density === "hero" ? 0.026 : 0.034, nextTick);
      if (disposed) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const canvas = document.createElement("canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.98;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const env = pmrem.fromScene(room, 0.04).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.6;
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.1, 7.4);

      const isDark = () => tone === "dark" || document.documentElement.getAttribute("data-theme") === "dark";

      /* The heart --------------------------------------------------------- */
      const bodyGeo = new THREE.BufferGeometry();
      bodyGeo.setAttribute("position", new THREE.BufferAttribute(model.body.positions, 3));
      bodyGeo.setAttribute("color", new THREE.BufferAttribute(model.body.colors, 3));
      bodyGeo.setIndex(new THREE.BufferAttribute(model.body.indices, 1));
      bodyGeo.setAttribute("normal", new THREE.BufferAttribute(model.body.normals, 3));
      // Wet tissue: muscle under a glossy clear coat, with a faint sheen at the edges.
      const wet = { metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.24 } as const;
      const tissue = new THREE.MeshPhysicalMaterial({ ...wet, vertexColors: true, roughness: 0.52, sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffb0a0") });
      const body = new THREE.Mesh(bodyGeo, tissue);

      // Vessels drawn as tubes — the coronaries in their fat, and the thinner great vessels with their open, cut ends.
      const mats = {
        artery: new THREE.MeshPhysicalMaterial({ ...wet, color: VESSEL_HEX.artery, roughness: 0.4 }),
        vein: new THREE.MeshPhysicalMaterial({ ...wet, color: VESSEL_HEX.vein, roughness: 0.42 }),
        aorta: new THREE.MeshPhysicalMaterial({ ...wet, color: VESSEL_HEX.aorta, roughness: 0.48 }),
        pulmonary: new THREE.MeshPhysicalMaterial({ ...wet, color: VESSEL_HEX.pulmonary, roughness: 0.48 }),
        pvein: new THREE.MeshPhysicalMaterial({ ...wet, color: VESSEL_HEX.pvein, roughness: 0.48 }),
        lumen: new THREE.MeshStandardMaterial({ color: VESSEL_HEX.lumen, roughness: 0.9, side: THREE.DoubleSide }),
      };
      const curveOf = (points: Float32Array) => {
        const pts: InstanceType<typeof THREE.Vector3>[] = [];
        for (let i = 0; i < points.length; i += 3) pts.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
        return new THREE.CatmullRomCurve3(pts);
      };
      const geos: InstanceType<typeof THREE.BufferGeometry>[] = [bodyGeo];
      const tubes = model.vessels.map((v) => {
        const g = new THREE.TubeGeometry(curveOf(v.points), Math.max(32, (v.points.length / 3) * 3), v.radius, 8, false);
        geos.push(g);
        return new THREE.Mesh(g, v.kind === "artery" ? mats.artery : mats.vein);
      });
      const great = model.great.flatMap((v) => {
        const curve = curveOf(v.points);
        const g = new THREE.TubeGeometry(curve, 48, v.radius, 14, false);
        const capGeo = new THREE.CircleGeometry(v.radius * 0.97, 18);
        geos.push(g, capGeo);
        // The cut end: a dark lumen inside the vessel wall.
        const end = curve.getPoint(1);
        const cap = new THREE.Mesh(capGeo, mats.lumen);
        cap.position.copy(end).addScaledVector(curve.getTangent(1), -0.004);
        cap.lookAt(end.clone().add(curve.getTangent(1)));
        return [new THREE.Mesh(g, mats[v.tissue]), cap];
      });

      const heart = new THREE.Group();
      heart.add(body, ...tubes, ...great);
      heart.position.set(-model.center[0], -model.center[1], -model.center[2]);
      const pivot = new THREE.Group();
      pivot.add(heart);
      const size = 1.42;

      /* Light ---------------------------------------------------------------- */
      const hemi = new THREE.HemisphereLight(0xffffff, 0x3a1416, 0.5);
      const key = new THREE.DirectionalLight(0xfff1e6, 2.5);
      key.position.set(-3, 4, 5);
      const rim = new THREE.DirectionalLight(0x8fd3ff, 2.4);
      rim.position.set(4, 1.5, -4);
      const fill = new THREE.DirectionalLight(0xffc4b4, 0.7);
      fill.position.set(3, -2.5, 3);
      scene.add(hemi, key, rim, fill);

      /* A soft glow behind, and drifting dust for depth ---------------------- */
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 128;
      const g2 = glowCanvas.getContext("2d")!;
      const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g2.fillStyle = grad;
      g2.fillRect(0, 0, 128, 128);
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(5.2);
      glow.position.set(0, 0, -1.6);

      const dustCount = density === "hero" ? 420 : 220;
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
      const dustMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.022, transparent: true, opacity: 0.5, depthWrite: false });
      const dustPts = new THREE.Points(dustGeo, dustMat);

      scene.add(glow, dustPts, pivot);

      let dark = isDark();
      const applyTheme = () => {
        dark = isDark();
        rim.intensity = dark ? 2.8 : 1.3;
        hemi.intensity = dark ? 0.38 : 0.5;
        scene.environmentIntensity = dark ? 0.42 : 0.5;
        glowMat.color.set(dark ? 0xff3b5c : 0xff8fa3);
        glowMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        dustMat.color.set(dark ? 0x93c5fd : 0x3b82f6);
        dustMat.opacity = dark ? 0.5 : 0.28;
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
        camera.position.z = width / height < 0.9 ? 7.4 / Math.max(0.55, width / height / 0.9) : 7.4;
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
      // Turned a little to the left, so the apex, the aortic arch and the coronaries all show.
      pivot.rotation.set(0.08, -0.32, 0.02);
      const render = () => {
        const t = clock.getElapsedTime();
        const b = reduce ? 0.15 : beat(t);
        pivot.scale.set(size * (1 - 0.022 * b), size * (1 - 0.032 * b), size * (1 - 0.022 * b));
        pivot.rotation.y += ((reduce ? -0.32 : Math.sin(t * 0.3) * 0.55 - 0.25 + pointer.x * 0.6) - pivot.rotation.y) * 0.05;
        pivot.rotation.x += ((reduce ? 0.08 : pointer.y * 0.22 + 0.08) - pivot.rotation.x) * 0.05;
        glowMat.opacity = (dark ? 0.3 : 0.26) + b * 0.06;
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
        geos.forEach((g) => g.dispose());
        tissue.dispose();
        Object.values(mats).forEach((m) => m.dispose());
        glowTex.dispose();
        glowMat.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        env.dispose();
        pmrem.dispose();
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
      {fallback && <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgb(244_63_94/0.45),rgb(139_92_246/0.2)_45%,transparent_70%)] blur-2xl" />}
    </div>
  );
}
