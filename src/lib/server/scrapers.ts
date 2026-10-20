/** Scraping tools, headless browsers and AI crawlers — never served (robots.txt tells the polite ones). */
const SCRAPER_UA = /python-requests|python-urllib|aiohttp|httpx|scrapy|wget|curl\/|go-http-client|okhttp|java\/|libwww|httpclient|node-fetch|axios\/|headlesschrome|phantomjs|puppeteer|playwright|selenium|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|ccbot|bytespider|perplexitybot|diffbot|amazonbot|meta-externalagent|cohere-ai|imagesiftbot|omgilibot|youbot|petalbot|semrushbot|ahrefsbot|mj12bot|dotbot/i;

/** A request from a scraper or crawler, or one with no browser at all. (Tests send no user agent.) */
export function isScraper(ua: string | null | undefined): boolean {
  if (!ua) return !process.env.VITEST && process.env.NODE_ENV === "production";
  return SCRAPER_UA.test(ua);
}
