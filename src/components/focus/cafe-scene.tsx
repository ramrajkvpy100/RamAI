/** A calm cartoon café: warm walls, a rainy arched window, swaying lamps, a shelf, plants and a counter — all drawn, gently animated. */
export function CafeScene() {
  return (
    <svg aria-hidden viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="cs-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6e6cf" /><stop offset="1" stopColor="#efd6b6" /></linearGradient>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fa9c4" /><stop offset="1" stopColor="#c9d6df" /></linearGradient>
        <radialGradient id="cs-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffe2a8" stopOpacity="0.85" /><stop offset="1" stopColor="#ffe2a8" stopOpacity="0" /></radialGradient>
        <clipPath id="cs-win"><path d="M110 330 V200 a90 90 0 0 1 180 0 V330 Z" /></clipPath>
      </defs>
      <rect width="400" height="800" fill="url(#cs-wall)" />
      {/* the window, rain running down it */}
      <path d="M104 336 V200 a96 96 0 0 1 192 0 V336 Z" fill="#a8774f" />
      <g clipPath="url(#cs-win)">
        <rect x="100" y="100" width="200" height="240" fill="url(#cs-sky)" />
        <path d="M100 300 L140 270 L170 285 L210 255 L250 280 L300 262 V340 H100 Z" fill="#7d93a8" opacity="0.7" />
        <path d="M100 318 L150 300 L190 312 L240 292 L300 308 V340 H100 Z" fill="#6b8296" opacity="0.8" />
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} className="cafe-rain" style={{ animationDelay: `${(i * 0.37) % 2}s`, animationDuration: `${1.6 + (i % 4) * 0.35}s` }} x1={112 + i * 13} y1="110" x2={110 + i * 13} y2="128" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
        ))}
      </g>
      <path d="M200 110 V336 M110 250 H290" stroke="#a8774f" strokeWidth="6" />
      <rect x="96" y="334" width="208" height="12" rx="3" fill="#8e6240" />
      {/* plants on the sill */}
      <g transform="translate(120 300)"><rect x="0" y="22" width="26" height="22" rx="4" fill="#d98b5f" /><path d="M13 24 C 2 10, 0 0, 6 -6 M13 24 C 16 6, 24 -2, 30 0 M13 24 C 10 8, 14 -4, 13 -12" stroke="#5f9a63" strokeWidth="6" strokeLinecap="round" fill="none" /></g>
      <g transform="translate(252 306)"><rect x="0" y="16" width="22" height="20" rx="4" fill="#c97b52" /><circle cx="11" cy="8" r="12" fill="#6fa86f" /><circle cx="3" cy="2" r="7" fill="#7fb67b" /></g>
      {/* lamps, swaying a little, with a warm glow */}
      {[70, 330].map((x, i) => (
        <g key={x} className="cafe-lamp" style={{ transformOrigin: `${x}px 0px`, animationDelay: `${i * 1.6}s` }}>
          <line x1={x} y1="0" x2={x} y2="80" stroke="#5b4636" strokeWidth="2" />
          <circle cx={x} cy="108" r="70" fill="url(#cs-lamp)" className="cafe-glow" />
          <path d={`M${x - 22} 100 Q ${x} 74 ${x + 22} 100 Z`} fill="#3f6f5c" />
          <circle cx={x} cy="102" r="7" fill="#ffe7b0" />
        </g>
      ))}
      {/* shelf with jars */}
      <rect x="20" y="420" width="120" height="8" rx="2" fill="#a8774f" />
      {[30, 58, 86, 112].map((x, i) => <rect key={x} x={x} y={392 - (i % 2) * 6} width="20" height={28 + (i % 2) * 6} rx="5" fill={["#e9c77b", "#c9876b", "#9fc29a", "#e3a76f"][i]} opacity="0.95" />)}
      <rect x="270" y="440" width="110" height="8" rx="2" fill="#a8774f" />
      {[280, 310, 340].map((x, i) => <circle key={x} cx={x + 8} cy={428} r="11" fill={["#f2d7a6", "#d79b7c", "#b9d1b1"][i]} />)}
      {/* the counter */}
      <rect x="0" y="560" width="400" height="240" fill="#b98657" />
      <rect x="0" y="548" width="400" height="18" fill="#8e6240" />
      <rect x="0" y="566" width="400" height="6" fill="#00000018" />
    </svg>
  );
}
