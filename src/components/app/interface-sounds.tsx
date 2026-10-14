"use client";

import { useEffect } from "react";

import { installTapSounds } from "@/lib/sfx";

/** A soft tap on every button press, site-wide (when sounds are on). */
export function InterfaceSounds() {
  useEffect(() => installTapSounds(), []);
  return null;
}
