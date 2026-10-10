import { appIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

/** Android crops maskable icons to its own shape: full-bleed, with the pulse inside the safe zone. */
export function GET() {
  return appIcon(512, { inset: 0.2 });
}
