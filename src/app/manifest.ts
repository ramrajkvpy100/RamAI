import type { MetadataRoute } from "next";

/** Lets RamAI be installed on a phone or computer and open like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RamAI — clinical cases for doctors",
    short_name: "RamAI",
    description: "Real-feeling patients, hidden diagnoses, no hints. A case a day keeps you sharp.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#05070d",
    categories: ["education", "medical"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
