import { appIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

export function GET() {
  return appIcon(512, { radius: 0.225 });
}
