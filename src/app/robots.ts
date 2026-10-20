import type { MetadataRoute } from "next";

/** Search engines may see the front page and the legal pages; nothing else. AI crawlers see nothing. */
export default function robots(): MetadataRoute.Robots {
  const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider", "Amazonbot", "Applebot-Extended", "Meta-ExternalAgent", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "YouBot"];
  return {
    rules: [
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
      { userAgent: "*", allow: ["/$", "/invite", "/privacy", "/terms", "/disclaimer", "/about", "/contact"], disallow: "/" },
    ],
  };
}
