import { notFound } from "next/navigation";

import { OrganScene } from "@/components/three/heart-scene";

const ALL = ["heart", "brain", "lungs"] as const;

/** Development only: the three organs side by side, light and dark — or one (?o=brain&tone=dark). */
export default async function Organs({ searchParams }: { searchParams: Promise<{ o?: string; tone?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { o, tone } = await searchParams;
  const organs = ALL.filter((x) => !o || x === o);
  const tones = tone === "dark" ? (["dark"] as const) : tone === "light" ? (["light"] as const) : (["dark", "light"] as const);
  return (
    <div className={organs.length === 1 && tones.length === 1 ? "p-6" : "grid grid-cols-3 gap-4 p-6"}>
      {tones.flatMap((t) =>
        organs.map((organ) => (
          <div key={`${organ}-${t}`} className={`${t === "dark" ? "ink" : "panel"} relative ${organs.length === 1 && tones.length === 1 ? "h-[640px]" : "h-[420px]"} overflow-hidden rounded-3xl`}>
            <OrganScene organ={organ} className="absolute inset-0" {...(t === "dark" ? { tone: "dark" as const } : {})} />
          </div>
        )),
      )}
    </div>
  );
}
