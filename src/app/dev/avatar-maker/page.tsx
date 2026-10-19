"use client";

import { AvatarMaker } from "@/components/profile/avatar-maker";

/** Development only: the avatar maker, open. */
export default function AvatarMakerPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="panel m-4 p-6 backdrop-blur">
      <AvatarMaker onClose={() => undefined} />
    </div>
  );
}
