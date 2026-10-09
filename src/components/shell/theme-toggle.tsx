"use client";

import { IconButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useThemePref, type ThemePref } from "@/lib/theme";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const ICON: Record<ThemePref, IconName> = { system: "system", light: "sun", dark: "moon" };

export function ThemeToggle() {
  const [pref, setPref] = useThemePref();
  return (
    <IconButton label={`Theme: ${pref} — switch`} size="sm" onClick={() => setPref(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]!)}>
      <Icon name={ICON[pref]} />
    </IconButton>
  );
}
