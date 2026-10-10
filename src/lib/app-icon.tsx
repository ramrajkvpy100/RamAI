import { ImageResponse } from "next/og";

const PULSE = "M10 35h12l4-9 6 19 5-14 3 4h14";

/**
 * The RamAI mark — gradient tile, white pulse line — as a PNG for home screens.
 *   inset  — shrinks the pulse into the safe zone of maskable icons
 *   radius — rounds the tile (0 for iOS and maskable icons, which are cropped anyway)
 */
function mark({ inset = 0, radius = 0 }: { inset?: number; radius?: number }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="64" height="64" rx="${radius * 64}" fill="url(#g)"/><g transform="translate(${32 * inset} ${32 * inset}) scale(${1 - inset})"><path d="${PULSE}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

/** Android's status-bar badge: a white silhouette on transparent. */
const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${PULSE}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const png = (svg: string, size: number) =>
  new ImageResponse(
    <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={size} height={size} alt="" />,
    { width: size, height: size },
  );

export const appIcon = (size: number, opts: { inset?: number; radius?: number } = {}) => png(mark(opts), size);
export const badgeIcon = (size: number) => png(BADGE, size);
