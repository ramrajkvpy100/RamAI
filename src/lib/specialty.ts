/** The doctor's own specialty: their cases come from it. "mixed" — every specialty (and the choice when they'd rather not say). */
import { ALL_SPECIALTIES } from "@/engine/progression";
import type { Specialty } from "@/engine/types";

export type PreferredSpecialty = Specialty | "mixed";

export const PREFERRED_SPECIALTIES: readonly PreferredSpecialty[] = ["mixed", ...ALL_SPECIALTIES];

export const isPreferredSpecialty = (v: unknown): v is PreferredSpecialty => typeof v === "string" && (PREFERRED_SPECIALTIES as readonly string[]).includes(v);

/** How the choice reads on screen. */
export const specialtyLabel = (s: PreferredSpecialty) => (s === "mixed" ? "Mixed — every specialty" : s === "OBGYN" ? "Obstetrics & Gynaecology" : s === "ENT" ? "ENT" : s);
