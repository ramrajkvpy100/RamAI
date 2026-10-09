/**
 * Procedural radiology: chest radiograph, ultrasound and fundus photography.
 * Findings are drawn geometrically from the spec's feature list and are never
 * annotated with an interpretation. Measurement calipers on ultrasound are
 * objective acquisition data, as on a real scanner.
 */
import { memo, useId, useMemo, type ReactElement } from "react";

import type { RadiographFeature, RadiographSpec } from "@/engine/types";
import { prngFrom } from "@/lib/prng";

const has = (f: RadiographFeature[], id: RadiographFeature["id"]) => f.find((x) => x.id === id);

/* -------------------------------------------------------------------------- */
/* Chest X-ray                                                                 */
/* -------------------------------------------------------------------------- */

function ChestXray({ spec, uid }: { spec: RadiographSpec; uid: string }) {
  const f = spec.features;
  const cardio = has(f, "cardiomegaly");
  const oedema = has(f, "bat-wing-oedema");
  const effusion = has(f, "pleural-effusion");
  const consolidation = has(f, "consolidation");
  const ptx = has(f, "pneumothorax");
  const freeAir = has(f, "free-air");

  // Heart: ~⅓ right of midline, ~⅔ left. CTR 0.45 normal, up to ~0.65 enlarged.
  const thorax = 220;
  const ctr = cardio ? 0.55 + (cardio.severity ?? 1) * 0.04 : 0.45;
  const hw = thorax * ctr;
  const hr = 150 - hw * 0.34;
  const hl = 150 + hw * 0.66;
  const rDome = 214;
  const lDome = 224;

  const vessels = useMemo(() => {
    const rand = prngFrom(spec.seed);
    const out: string[] = [];
    const branch = (x: number, y: number, angle: number, len: number, depth: number) => {
      if (depth === 0 || len < 3) return;
      const x2 = x + Math.cos(angle) * len;
      const y2 = y + Math.sin(angle) * len;
      out.push(`M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
      branch(x2, y2, angle - 0.32 - rand() * 0.3, len * 0.7, depth - 1);
      branch(x2, y2, angle + 0.32 + rand() * 0.3, len * 0.66, depth - 1);
    };
    for (let i = 0; i < 7; i++) branch(128, 132, Math.PI + (-1.25 + i * 0.4), 18 + rand() * 6, 4);
    for (let i = 0; i < 7; i++) branch(172, 134, (-1.25 + i * 0.4), 18 + rand() * 6, 4);
    return out.join("");
  }, [spec.seed]);

  const ribs = Array.from({ length: 10 }, (_, i) => {
    const y = 48 + i * 18.5;
    const drop = 22 + i * 1.6;
    return {
      r: `M146 ${y} C 118 ${y - 10}, 74 ${y - 4}, ${56 - Math.min(i, 5) * 2} ${y + drop}`,
      l: `M154 ${y} C 182 ${y - 10}, 226 ${y - 4}, ${244 + Math.min(i, 5) * 2} ${y + drop}`,
    };
  });

  const rightLung = `M141 50 C 118 46, 92 58, 76 86 C 60 116, 52 160, 50 ${rDome + 14} C 70 ${rDome - 6}, 104 ${rDome - 10}, ${hr - 2} ${rDome - 4} L ${hr} 150 C ${hr + 6} 128, 138 118, 141 104 Z`;
  const leftLung = `M159 50 C 182 46, 208 58, 224 86 C 240 116, 248 160, 250 ${lDome + 12} C 236 ${lDome - 2}, ${hl + 8} ${lDome - 8}, ${hl} ${lDome - 12} C ${hl + 4} 186, ${hl - 8} 150, 178 128 C 168 118, 162 112, 159 104 Z`;

  return (
    <>
      <defs>
        <radialGradient id={`${uid}-body`} cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor="#5b5b5b" />
          <stop offset="100%" stopColor="#262626" />
        </radialGradient>
        <linearGradient id={`${uid}-lungR`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#0e0e0e" />
        </linearGradient>
        <linearGradient id={`${uid}-lungL`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#0e0e0e" />
        </linearGradient>
        <radialGradient id={`${uid}-heart`} cx="40%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#d2d2d2" />
          <stop offset="100%" stopColor="#a9a9a9" />
        </radialGradient>
        <linearGradient id={`${uid}-abdo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c6c6c6" />
          <stop offset="100%" stopColor="#8c8c8c" />
        </linearGradient>
        <radialGradient id={`${uid}-haze`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e6e6e6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e6e6e6" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={spec.seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.1 0" />
        </filter>
        <filter id={`${uid}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id={`${uid}-blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
        <clipPath id={`${uid}-lungs`}>
          <path d={rightLung} />
          <path d={leftLung} />
        </clipPath>
        <clipPath id={`${uid}-thorax`}>
          <path d="M60 30 C 100 20, 200 20, 240 30 L 268 300 L 32 300 Z" />
        </clipPath>
      </defs>

      <rect width="300" height="300" fill="#050505" />
      {/* Neck, shoulders, chest wall */}
      <path d="M118 0 L182 0 L186 26 C 214 30, 258 36, 286 66 L 296 300 L 4 300 L 14 66 C 42 36, 86 30, 114 26 Z" fill={`url(#${uid}-body)`} />
      {/* Humeral heads */}
      <circle cx="22" cy="72" r="20" fill="#9a9a9a" opacity="0.55" filter={`url(#${uid}-soft)`} />
      <circle cx="278" cy="72" r="20" fill="#9a9a9a" opacity="0.55" filter={`url(#${uid}-soft)`} />

      {/* Lungs */}
      <path d={rightLung} fill={`url(#${uid}-lungR)`} />
      <path d={leftLung} fill={`url(#${uid}-lungL)`} />
      <g clipPath={`url(#${uid}-lungs)`}>
        <path d={vessels} stroke="#7a7a7a" strokeWidth="1.2" fill="none" opacity={ptx ? 0.25 : 0.55} filter={`url(#${uid}-soft)`} />
        {ptx && <path d={ptx.side === "left" ? "M206 58 C 232 100, 240 160, 236 214 L 252 214 L 252 50 Z" : "M94 58 C 68 100, 60 160, 64 214 L 48 214 L 48 50 Z"} fill="#030303" />}
        {oedema && (
          <>
            <ellipse cx="116" cy="140" rx="44" ry="42" fill={`url(#${uid}-haze)`} opacity={0.45 + (oedema.severity ?? 2) * 0.17} />
            <ellipse cx="186" cy="142" rx="44" ry="42" fill={`url(#${uid}-haze)`} opacity={0.45 + (oedema.severity ?? 2) * 0.17} />
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} stroke="#bdbdbd" strokeWidth="0.7" opacity="0.65">
                <path d={`M${53 + i} ${186 + i * 6} h10`} />
                <path d={`M${247 - i} ${190 + i * 6} h-10`} />
              </g>
            ))}
          </>
        )}
        {consolidation && (
          <g>
            <ellipse cx={consolidation.side === "left" ? 214 : 88} cy={178} rx="30" ry="32" fill="#d0d0d0" opacity="0.85" filter={`url(#${uid}-blur)`} />
            <path d={consolidation.side === "left" ? "M200 160 l9 14 l-3 11 M211 168 l6 12" : "M100 160 l-9 14 l3 11 M89 168 l-6 12"} stroke="#141414" strokeWidth="1.5" fill="none" opacity="0.8" />
          </g>
        )}
        {effusion &&
          (["right", "left"] as const)
            .filter((side) => effusion.side === "bilateral" || effusion.side === side || !effusion.side)
            .map((side) => {
              const h = 26 + (effusion.severity ?? 1) * 14;
              return side === "right" ? (
                <path key={side} d={`M48 ${rDome + 20} L48 ${rDome - h} C 52 ${rDome - h * 0.35}, 74 ${rDome - 8}, ${hr} ${rDome - 2} L ${hr} ${rDome + 20} Z`} fill="#c4c4c4" opacity="0.92" filter={`url(#${uid}-soft)`} />
              ) : (
                <path key={side} d={`M252 ${lDome + 20} L252 ${lDome - h} C 248 ${lDome - h * 0.35}, 226 ${lDome - 8}, ${hl} ${lDome - 8} L ${hl} ${lDome + 20} Z`} fill="#c4c4c4" opacity="0.92" filter={`url(#${uid}-soft)`} />
              );
            })}
      </g>
      {ptx && <path d={ptx.side === "left" ? "M206 58 C 232 100, 240 160, 236 214" : "M94 58 C 68 100, 60 160, 64 214"} stroke="#b5b5b5" strokeWidth="0.9" fill="none" />}

      {/* Mediastinum, trachea, aortic knob, heart */}
      <path d={`M136 20 L164 20 L166 104 C 176 108, 184 116, 182 126 L ${hl - 6} 148 C ${hl + 6} 176, ${hl + 4} 210, ${hl - 4} ${lDome - 8} C 190 ${lDome + 2}, 150 ${lDome + 4}, ${hr + 2} ${rDome + 2} C ${hr - 6} 200, ${hr - 6} 166, ${hr + 4} 146 C 132 130, 136 118, 136 104 Z`} fill={`url(#${uid}-heart)`} filter={`url(#${uid}-soft)`} />
      <ellipse cx="178" cy="114" rx="11" ry="9" fill="#cfcfcf" opacity="0.9" filter={`url(#${uid}-soft)`} />
      <path d="M146 18 L154 18 L154 100 L170 122 L166 124 L150 104 L134 124 L130 122 L146 100 Z" fill="#202020" opacity="0.5" filter={`url(#${uid}-soft)`} />

      {/* Diaphragm and upper abdomen */}
      <path d={`M40 300 L40 ${rDome + 22} C 64 ${rDome - 6}, 110 ${rDome - 12}, 150 ${rDome + 8} C 190 ${lDome - 12}, 236 ${lDome - 6}, 260 ${lDome + 20} L260 300 Z`} fill={`url(#${uid}-abdo)`} />
      <ellipse cx="206" cy={lDome + 22} rx="20" ry="11" fill="#1a1a1a" opacity="0.85" filter={`url(#${uid}-soft)`} />
      {freeAir && <path d={`M70 ${rDome + 10} C 92 ${rDome - 4}, 120 ${rDome - 4}, 140 ${rDome + 8} C 120 ${rDome + 3}, 92 ${rDome + 3}, 70 ${rDome + 12} Z`} fill="#050505" />}

      {/* Ribs and clavicles */}
      <g clipPath={`url(#${uid}-thorax)`} fill="none" stroke="#d8d8d8" strokeLinecap="round">
        {ribs.map((r, i) => (
          <g key={i} strokeWidth="3.2" opacity={0.2 - i * 0.008}>
            <path d={r.r} />
            <path d={r.l} />
          </g>
        ))}
      </g>
      <path d="M142 46 C 120 38, 92 34, 62 38" stroke="#e2e2e2" strokeWidth="6" fill="none" opacity="0.62" strokeLinecap="round" filter={`url(#${uid}-soft)`} />
      <path d="M158 46 C 180 38, 208 34, 238 38" stroke="#e2e2e2" strokeWidth="6" fill="none" opacity="0.62" strokeLinecap="round" filter={`url(#${uid}-soft)`} />

      <rect width="300" height="300" filter={`url(#${uid}-grain)`} />
      <text x="14" y="26" fill="#f0f0f0" fontSize="13" fontFamily="var(--font-mono)" opacity="0.85">R</text>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Ultrasound                                                                  */
/* -------------------------------------------------------------------------- */

function Ultrasound({ spec, uid }: { spec: RadiographSpec; uid: string }) {
  const f = spec.features;
  const appendix = has(f, "appendix-thickened");
  const stone = has(f, "gallstone");
  const hydro = has(f, "hydronephrosis");
  const linear = /linear/i.test(spec.view);
  const sector = "M150 18 L278 230 A 150 150 0 0 1 22 230 Z";
  const frame = linear ? "M30 20 H270 V270 H30 Z" : sector;
  const perforated = (appendix?.severity ?? 1) >= 3;

  return (
    <>
      <defs>
        <clipPath id={`${uid}-fan`}><path d={frame} /></clipPath>
        <filter id={`${uid}-speckle`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1 2.2" numOctaves="3" seed={spec.seed} />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.25 -0.44" />
        </filter>
        <filter id={`${uid}-blur`}><feGaussianBlur stdDeviation="1.4" /></filter>
        <linearGradient id={`${uid}-depth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}-shadow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="#000" />
      <g clipPath={`url(#${uid}-fan)`}>
        <rect width="300" height="300" fill="#1c1c1c" />
        <rect width="300" height="300" filter={`url(#${uid}-speckle)`} opacity="0.8" />
        {/* Skin, fat, muscle layers */}
        <rect x="0" y="18" width="300" height="10" fill="#d0d0d0" opacity="0.55" />
        <rect x="0" y="40" width="300" height="5" fill="#a0a0a0" opacity="0.5" />
        <path d="M0 62 Q 150 50 300 64 L300 72 Q 150 60 0 70 Z" fill="#b0b0b0" opacity="0.45" />
        {appendix && !perforated && (
          <g>
            <ellipse cx="150" cy="132" rx="62" ry="46" fill="#cfcfcf" opacity="0.28" filter={`url(#${uid}-blur)`} />
            <g filter={`url(#${uid}-blur)`}>
              <ellipse cx="150" cy="132" rx="30" ry="24" fill="#9e9e9e" />
              <ellipse cx="150" cy="132" rx="25" ry="19.5" fill="#202020" />
              <ellipse cx="150" cy="132" rx="15" ry="11" fill="#cdcdcd" />
              <ellipse cx="150" cy="132" rx="9.5" ry="6.5" fill="#363636" />
            </g>
            <path d="M137 170 Q 150 161 164 170" stroke="#f2f2f2" strokeWidth="5" fill="none" strokeLinecap="round" filter={`url(#${uid}-blur)`} />
            <rect x="139" y="173" width="24" height="112" fill={`url(#${uid}-shadow)`} filter={`url(#${uid}-blur)`} />
            <g stroke="#ffe066" strokeWidth="1" fill="#ffe066" fontFamily="var(--font-mono)" fontSize="8">
              <path d="M120 132 h-6 M180 132 h6" />
              <path d="M123 128 l-3 4 3 4 M177 128 l3 4 -3 4" fill="none" />
              <text x="190" y="128" stroke="none">D 9.2 mm</text>
            </g>
          </g>
        )}
        {appendix && perforated && (
          <g>
            <path d="M104 116 Q 120 92 158 98 Q 204 104 200 140 Q 196 176 154 178 Q 112 176 104 146 Z" fill="#262626" filter={`url(#${uid}-blur)`} />
            <path d="M104 116 Q 120 92 158 98 Q 204 104 200 140 Q 196 176 154 178 Q 112 176 104 146 Z" filter={`url(#${uid}-speckle)`} opacity="0.35" />
            <path d="M208 196 Q 238 204 262 232 L 262 252 Q 230 222 204 216 Z" fill="#141414" filter={`url(#${uid}-blur)`} />
          </g>
        )}
        {stone && (
          <g>
            <ellipse cx="150" cy="130" rx="60" ry="34" fill="#080808" />
            <path d="M134 150 Q 150 138 168 150" stroke="#fafafa" strokeWidth="6" fill="none" strokeLinecap="round" />
            <rect x="134" y="153" width="34" height="120" fill={`url(#${uid}-shadow)`} />
          </g>
        )}
        {hydro && (
          <g>
            <ellipse cx="150" cy="140" rx="74" ry="40" fill="#8e8e8e" opacity="0.7" />
            <path d="M120 140 Q 140 118 170 128 Q 186 140 170 154 Q 144 162 120 140 Z" fill="#050505" />
            <circle cx="132" cy="122" r="8" fill="#050505" />
            <circle cx="176" cy="122" r="7" fill="#050505" />
          </g>
        )}
        {!appendix && !stone && !hydro && (
          <g opacity="0.85">
            <path d="M40 150 Q 100 120 160 150 T 280 150" stroke="#cfcfcf" strokeWidth="6" fill="none" opacity="0.4" />
            <ellipse cx="110" cy="190" rx="34" ry="14" fill="#151515" opacity="0.8" />
            <ellipse cx="200" cy="200" rx="30" ry="12" fill="#151515" opacity="0.7" />
          </g>
        )}
        <rect width="300" height="300" fill={`url(#${uid}-depth)`} />
      </g>
      <path d={frame} fill="none" stroke="#3a3a3a" strokeWidth="1" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} fill="#9a9a9a" fontFamily="var(--font-mono)" fontSize="7">
          <path d={`M286 ${30 + i * 44} h6`} stroke="#9a9a9a" />
          <text x="276" y={33 + i * 44} textAnchor="end">{i}</text>
        </g>
      ))}
      <text x="14" y="22" fill="#d6d6d6" fontSize="9" fontFamily="var(--font-mono)">{linear ? "L 9.0 MHz" : "C 3.5 MHz"}</text>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Fundus                                                                      */
/* -------------------------------------------------------------------------- */

function Fundus({ spec, uid }: { spec: RadiographSpec; uid: string }) {
  const f = spec.features;
  const rand = prngFrom(spec.seed);
  const vessels: ReactElement[] = [];
  const disc = { x: 200, y: 150 };
  for (let i = 0; i < 4; i++) {
    const up = i < 2;
    const side = i % 2 === 0 ? -1 : 1;
    const c1 = `${disc.x - 40 - rand() * 20} ${disc.y + (up ? -60 : 60)}`;
    const end = `${disc.x - 150 - rand() * 30} ${disc.y + (up ? -90 : 90) + side * 10}`;
    vessels.push(<path key={`v${i}`} d={`M${disc.x} ${disc.y} Q ${c1} ${end}`} stroke="#7a1d14" strokeWidth={3.6 - (i % 2)} fill="none" opacity="0.9" />);
    vessels.push(<path key={`a${i}`} d={`M${disc.x + 2} ${disc.y + 2} Q ${disc.x - 30} ${disc.y + (up ? -40 : 40)} ${disc.x - 130 - rand() * 30} ${disc.y + (up ? -70 : 70) - side * 12}`} stroke="#c2412a" strokeWidth={2.2} fill="none" opacity="0.9" />);
  }
  const dots = (id: RadiographFeature["id"], n: number, render: (x: number, y: number, i: number) => ReactElement) =>
    has(f, id) ? Array.from({ length: n }, (_, i) => render(60 + rand() * 170, 70 + rand() * 160, i)) : [];
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-retina`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d9612e" />
          <stop offset="70%" stopColor="#b5401c" />
          <stop offset="100%" stopColor="#5a1508" />
        </radialGradient>
        <radialGradient id={`${uid}-disc`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2c2" />
          <stop offset="60%" stopColor="#f2c879" />
          <stop offset="100%" stopColor="#e09a4a" stopOpacity={has(f, "disc-oedema") ? 0.2 : 1} />
        </radialGradient>
        <clipPath id={`${uid}-circle`}><circle cx="150" cy="150" r="138" /></clipPath>
        <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <rect width="300" height="300" fill="#000" />
      <g clipPath={`url(#${uid}-circle)`}>
        <rect width="300" height="300" fill={`url(#${uid}-retina)`} />
        <circle cx="120" cy="152" r="22" fill="#7d2410" opacity="0.45" filter={`url(#${uid}-soft)`} />
        <circle cx="120" cy="152" r="2.2" fill="#fff3d6" opacity="0.8" />
        {vessels}
        <circle cx={disc.x} cy={disc.y} r={has(f, "disc-oedema") ? 30 : 22} fill={`url(#${uid}-disc)`} filter={has(f, "disc-oedema") ? `url(#${uid}-soft)` : undefined} />
        <circle cx={disc.x + 3} cy={disc.y} r="7" fill="#fff8e0" opacity="0.85" />
        {dots("microaneurysms", 16, (x, y, i) => <circle key={`m${i}`} cx={x} cy={y} r={1.2 + (i % 3) * 0.7} fill="#5c0a07" />)}
        {dots("hard-exudates", 14, (x, y, i) => <circle key={`h${i}`} cx={x} cy={y} r={1.4 + (i % 2)} fill="#f6e08a" opacity="0.95" />)}
        {dots("cotton-wool-spots", 4, (x, y, i) => <ellipse key={`c${i}`} cx={x} cy={y} rx="9" ry="6" fill="#f5efe6" opacity="0.75" filter={`url(#${uid}-soft)`} />)}
      </g>
    </>
  );
}

export const RadiographImage = memo(function RadiographImage({ spec, className }: { spec: RadiographSpec; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const label = spec.kind === "xray" ? "Chest radiograph" : spec.kind === "usg" ? "Ultrasound image" : spec.kind === "fundus" ? "Fundus photograph" : "Cross-sectional image";
  return (
    <svg viewBox="0 0 300 300" className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {spec.kind === "xray" && <ChestXray spec={spec} uid={uid} />}
      {spec.kind === "usg" && <Ultrasound spec={spec} uid={uid} />}
      {spec.kind === "fundus" && <Fundus spec={spec} uid={uid} />}
      {(spec.kind === "ct" || spec.kind === "mri") && (
        <>
          <rect width="300" height="300" fill="#000" />
          <ellipse cx="150" cy="150" rx="120" ry="96" fill="#5a5a5a" />
          <ellipse cx="150" cy="150" rx="110" ry="86" fill="#2c2c2c" />
          <circle cx="150" cy="196" r="14" fill="#d0d0d0" />
        </>
      )}
    </svg>
  );
});
