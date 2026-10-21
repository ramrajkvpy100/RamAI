import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

import { PUBLIC_PAGES } from "./sitemap";

/** Search engines may see the public pages (listed in the sitemap); the app itself and the API stay out. AI crawlers see nothing. */
export default function robots(): MetadataRoute.Robots {
  const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider", "Amazonbot", "Applebot-Extended", "Meta-ExternalAgent", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "YouBot"];
  return {
    rules: [
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
      { userAgent: "*", allow: ["/$", "/s/", ...PUBLIC_PAGES.filter((p) => p !== "/")], disallow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
