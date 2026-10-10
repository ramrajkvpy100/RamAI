import type { SVGProps } from "react";

/**
 * A restrained, single-weight icon set (24 grid, 1.5 stroke). Decorative by
 * default; pass `label` to expose an icon to assistive technology.
 */
const PATHS = {
  "arrow-up": "M12 19V5M5 12l7-7 7 7",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  "arrow-left": "M19 12H5M11 19l-7-7 7-7",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-up": "M18 15l-6-6-6 6",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 16v-5M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  pulse: "M3 12h4l2.5-6 4 12 2.5-6H21",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
  chat: "M4 5h16v11H8l-4 4V5z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 18.6l-2.3-4a1.5 1.5 0 0 1 2.6-1.5L8 15",
  flask: "M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8",
  pill: "M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM8.5 8.5l7 7",
  syringe: "M18 2l4 4M15 5l4 4M17 7l-9.5 9.5-4 1 1-4L14 4zM9 9l2 2M6 12l2 2",
  scalpel: "M4 20l8.5-8.5M12.5 11.5 19 5a2 2 0 0 1 0 2.8l-6 6.2-3.5-2.5z",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4M6 11h2.5l1.5-3 2 6 1.5-3H18",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  timeline: "M6 4v16M6 7h9M6 12h12M6 17h7",
  "panel-right-close": "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4v16M8 9l3 3-3 3",
  "panel-right-open": "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4v16M10 15l-3-3 3-3",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  system: "M4 5h16v11H4zM9 20h6M12 16v4",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 13h8M8 17h5",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  droplet: "M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z",
  flame: "M12 21a6 6 0 0 0 6-6c0-4-3-6-3-9-2 1.5-3 3-3 5-1-1-2-2-2-4-3 2.5-4 5.4-4 8a6 6 0 0 0 6 6z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  close: "M18 6 6 18M6 6l12 12",
  logout: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  sparkline: "M3 17l5-6 4 3 4-7 5 5",
  thermometer: "M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z",
  ear: "M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6",
  send: "M5 12h14M13 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  lock: "M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  star: "m12 3.2 2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.7l-5.3 2.9 1.1-6-4.4-4.1 6-.8z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4",
  phone: "M5.5 4h3l1.8 4.6-2.3 1.5a11 11 0 0 0 5.9 5.9l1.5-2.3L20 15.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4z",
  siren: "M7 18v-5.5a5 5 0 0 1 10 0V18M5 18h14v3H5zM12 2.5v2M4.6 5.6l1.4 1.4M19.4 5.6 18 7",
  building: "M4 21V7.5L12 3l8 4.5V21M3 21h18M10 21v-5h4v5M12 7.5v4M10 9.5h4",
  crown: "M3.5 8.5 7.5 12 12 5l4.5 7 4-3.5L18.5 19h-13z",
  sparkles: "M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9zM18.5 3v3M17 4.5h3M5.5 17v3M4 18.5h3",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.6 13.9 7 21l5-2.8 5 2.8-1.6-7.1",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2.5 21a6.5 6.5 0 0 1 13 0M16 3.3a4 4 0 0 1 0 7.4M21.5 21a6.5 6.5 0 0 0-4-6",
  shuffle: "M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5",
  "trending-up": "M3 17l6-6 4 4 8-8M15 7h6v6",
  image: "M4 5h16v14H4zM4 15.5l4.5-4.5 4.5 4.5 3-3 4 4M15.5 9h.01",
  home: "M4 10.5 12 4l8 6.5V20H4zM10 20v-5.5h4V20",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  key: "M15.5 9.5a4.5 4.5 0 1 0-4.1 4.5L9 16.4V19H6.5v2H3.5v-3.4l6.9-6.9",
  volume: "M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
  "volume-off": "M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6",
  "zoom-in": "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5M10.5 7.5v6M7.5 10.5h6",
  "zoom-out": "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5M7.5 10.5h6",
  maximize: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  "chevron-left": "M15 6l-6 6 6 6",
  "bell-off": "M9 17v1a3 3 0 0 0 6 0v-1M6.5 6.5A6 6 0 0 0 6 9c0 5-2 6-2 6h11M18 13c0-1.2 0-2.6 0-4a6 6 0 0 0-9-5.2M3 3l18 18",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  bell: "M9 17v1a3 3 0 0 0 6 0v-1M18 9a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z",
  /** Safari's Share button. */
  "share-ios": "M12 15V3M8 7l4-4 4 4M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2",
  /** "Add to Home Screen". */
  "plus-square": "M12 8v8M8 12h8M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z",
  /** An installed app. */
  device: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  label?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, label, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
