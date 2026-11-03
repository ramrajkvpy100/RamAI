/**
 * The arithmetic of "near me", shared by server and phone. The privacy of the feature rests on the first two: a position is
 * snapped to a fixed grid before it is stored, and a distance is rounded before it leaves the server. A fixed grid rather than
 * random noise, so asking again and again (or from many made-up places) can never narrow a doctor down below one square.
 */

/** A presence row is gone ten minutes after the last heartbeat. */
export const PRESENCE_TTL_MS = 10 * 60_000;
/** The side of a grid square, metres: enough to say which part of a campus, never which room. */
export const GRID_M = 100;
/** Worse than this the phone doesn't know where it is, and a 1–2 km list would be wrong. */
export const WORST_ACCURACY_M = 2000;
const M_PER_DEGREE = 111_320;

export interface LatLng { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The centre of the grid square this point falls in. The only position ever stored. */
export function snapToGrid({ lat, lng }: LatLng): LatLng {
  const step = GRID_M / M_PER_DEGREE;
  const snappedLat = Math.round(lat / step) * step;
  const lngStep = step / Math.max(0.01, Math.cos((snappedLat * Math.PI) / 180));
  return { lat: Number(snappedLat.toFixed(6)), lng: Number((Math.round(lng / lngStep) * lngStep).toFixed(6)) };
}

/** Distance as other doctors may see it: never under 100 m, 50 m steps to 1 km, 100 m steps to 10 km, then whole km. */
export function roundDistance(meters: number): number {
  const to = (step: number) => Math.round(meters / step) * step;
  if (meters < 1000) return Math.max(GRID_M, to(50));
  return meters < 10_000 ? to(100) : to(1000);
}

export function formatDistance(rounded: number): string {
  if (rounded <= GRID_M) return "Within 100 m";
  return rounded < 1000 ? `${rounded} m away` : `${Number((rounded / 1000).toFixed(1))} km away`;
}

export function formatSeen(minutesAgo: number): string {
  return minutesAgo < 2 ? "Active now" : `Active ${minutesAgo}m ago`;
}

export interface NearbyView {
  id: string;
  name: string;
  rankTier: number;
  rankLabel: string;
  specialty: string | null;
  /** Rounded metres; null for a doctor listed only by city, who isn't sharing a location. */
  distanceM: number | null;
  /** Minutes since their last heartbeat; null when not sharing. */
  seenMinAgo: number | null;
  /** When they last started a case (ms): for doctors listed by city. */
  activeAt: number | null;
  inCity: boolean;
}

export type NearbyFilter = "1km" | "2km" | "10km" | "city";
export const NEARBY_FILTERS: readonly { id: NearbyFilter; label: string; meters: number | null }[] = [
  { id: "1km", label: "Within 1 km", meters: 1000 },
  { id: "2km", label: "Within 2 km", meters: 2000 },
  { id: "10km", label: "Within 10 km", meters: 10_000 },
  { id: "city", label: "My City", meters: null },
];

/** Nearest first; those with no distance last, the most recently active first. */
export function filterDoctors<T extends NearbyView>(doctors: readonly T[], filter: NearbyFilter): T[] {
  const limit = NEARBY_FILTERS.find((f) => f.id === filter)?.meters ?? null;
  return doctors
    .filter((d) => (limit === null ? d.inCity : d.distanceM !== null && d.distanceM <= limit))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || (b.activeAt ?? 0) - (a.activeAt ?? 0));
}
