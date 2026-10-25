/** Café: a hand-drawn café full of quiet workers — the picture drifts very slowly, lamps glow, cups steam. */
export function CafeScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#f6eedd]">
      <picture>
        <source media="(min-aspect-ratio: 1/1)" srcSet="/focus/cafe-wide.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/focus/cafe-tall.jpg" alt="" className="cafe-drift absolute inset-0 h-full w-full object-cover object-top" draggable={false} />
      </picture>
      <span className="cafe-glow absolute top-[6%] left-[30%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_230_170/0.55),transparent_65%)]" />
      <span className="cafe-glow absolute top-[6%] right-[20%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_230_170/0.55),transparent_65%)] [animation-delay:2.5s]" />
      {[16, 40, 66, 92].map((x, i) => (
        <span key={x} className="steam-puff absolute h-3 w-3 rounded-full bg-white" style={{ left: `${x}%`, top: "38%", animationDelay: `${i * 1.4}s`, animationDuration: "6s" }} />
      ))}
    </div>
  );
}

/** Street: the view out of the café window — the city going by, through the glass. */
export function StreetScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
      <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
        <source src="/focus/street-day.webm" type="video/webm" />
        <source src="/focus/street-day.mp4" type="video/mp4" />
      </video>
      {/* The window: a soft reflection on the glass, wooden frame and mullion. */}
      <span className="absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.14)_0%,transparent_35%,transparent_60%,rgb(255_255_255/0.08)_75%,transparent_90%)]" />
      <span className="absolute inset-0 shadow-[inset_0_0_0_14px_#6b4a33,inset_0_0_40px_14px_rgb(0_0_0/0.35)]" />
      <span className="absolute top-0 bottom-0 left-1/2 w-3 -translate-x-1/2 bg-[#6b4a33] shadow-[0_0_12px_rgb(0_0_0/0.35)]" />
      <span className="absolute inset-x-0 top-[38%] h-3 bg-[#6b4a33] shadow-[0_0_12px_rgb(0_0_0/0.35)]" />
    </div>
  );
}
