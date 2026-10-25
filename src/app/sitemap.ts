import type { MetadataRoute } from "next";

import { learnEntries } from "@/lib/learn";
import { SITE } from "@/lib/site";

/** The pages anyone may open and search engines may list. */
export const PUBLIC_PAGES = ["/", "/about", "/faq", "/learn", "/pricing", "/login", "/signup", "/contact", "/privacy", "/terms", "/disclaimer", "/refund-policy", "/shipping-policy", "/delete-account"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [...PUBLIC_PAGES.map((path) => ({
    url: `${SITE.url}${path === "/" ? "" : path}`,
    changeFrequency: (path === "/" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: path === "/" ? 1 : path === "/about" || path === "/faq" || path === "/learn" || path === "/pricing" ? 0.8 : 0.4,
  })), ...learnEntries().map((e) => ({ url: `${SITE.url}/learn/${e.slug}`, changeFrequency: "monthly" as const, priority: 0.6 }))];
}
