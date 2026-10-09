import { notFound } from "next/navigation";

import { MediaLab } from "./media-lab";

/** Development-only gallery of procedural clinical media, for case authors. */
export default function MediaLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MediaLab />;
}
