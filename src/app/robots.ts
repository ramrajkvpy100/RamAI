import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

import { PUBLIC_PAGES } from "./sitemap";

/**
 * Search engines and AI answer engines (ChatGPT search, Perplexity, Claude, Gemini answers) may read the public pages,
 * so RamAI can be found and cited; the app itself and the API stay out. Crawlers that only collect training data see nothing.
 */
export default function robots(): MetadataRoute.Robots {
  const TRAINING_ONLY = ["GPTBot", "CCBot", "Bytespider", "anthropic-ai", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "Meta-ExternalAgent"];
  return {
    rules: [
      ...TRAINING_ONLY.map((userAgent) => ({ userAgent, disallow: "/" })),
      { userAgent: "*", allow: ["/$", "/s/", "/llms.txt", "/learn", ...PUBLIC_PAGES.filter((p) => p !== "/")], disallow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
