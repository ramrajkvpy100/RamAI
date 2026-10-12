import { notFound } from "next/navigation";

import { HeartScene } from "@/components/three/heart-scene";

/** Development only: the heart alone, large, on nothing — to capture it for the share cards. */
export default function HeartCapture() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ width: 1100, height: 1100, background: "transparent" }}>
      <HeartScene className="h-[1100px] w-[1100px]" tone="dark" bare />
    </div>
  );
}
