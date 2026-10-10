import { badgeIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

/** The small monochrome icon Android shows in the status bar for a reminder. */
export function GET() {
  return badgeIcon(96);
}
