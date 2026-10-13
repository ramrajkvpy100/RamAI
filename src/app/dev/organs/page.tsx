import { notFound } from "next/navigation";

import { OrganScene } from "@/components/three/heart-scene";

/** Development only: the three organs side by side, light and dark. */
export default function Organs() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {(["heart", "brain", "lungs"] as const).map((o) => (
        <div key={o} className="ink relative h-[420px] overflow-hidden rounded-3xl">
          <OrganScene organ={o} className="absolute inset-0" tone="dark" />
        </div>
      ))}
      {(["heart", "brain", "lungs"] as const).map((o) => (
        <div key={`${o}-light`} className="panel relative h-[420px] overflow-hidden rounded-3xl">
          <OrganScene organ={o} className="absolute inset-0" />
        </div>
      ))}
    </div>
  );
}
