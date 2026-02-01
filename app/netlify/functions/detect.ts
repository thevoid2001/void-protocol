import type { Handler, HandlerEvent } from "@netlify/functions";

interface DetectedFeed {
  title: string;
  url: string;
  type: string;
}

const COMMON_FEED_PATHS = [
  "/feed",
  "/feed/",
  "/rss",
  "/rss/",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feed/rss",
  "/feed/atom",
  "/.rss",
  "/blog/feed",
  "/blog/rss",
];

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const urlParam = event.queryStringParameters?.url;

  if (!urlParam) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing 'url' parameter" }),
    };
  }

  let url: URL;
  try {
    url = new URL(urlParam);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid URL" }),
    };
  }

  const feeds: DetectedFeed[] = [];

  try {
    // Fetch the HTML page
    const response = await fetch(url.href, {
      headers: {
        "User-Agent": "Void Feed RSS Detector/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Look for RSS/Atom link tags in the HTML
    const linkRegex = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
    const matches = html.match(linkRegex) || [];

    for (const match of matches) {
      const typeMatch = match.match(/type=["']([^"']+)["']/i);
      const hrefMatch = match.match(/href=["']([^"']+)["']/i);
      const titleMatch = match.match(/title=["']([^"']+)["']/i);

      if (hrefMatch && typeMatch) {
        const type = typeMatch[1].toLowerCase();
        if (
          type.includes("rss") ||
          type.includes("atom") ||
          type.includes("xml")
        ) {
          const feedUrl = new URL(hrefMatch[1], url).href;
          feeds.push({
            title: titleMatch ? titleMatch[1] : "RSS Feed",
            url: feedUrl,
            type: type.includes("atom") ? "atom" : "rss",
          });
        }
      }
    }

    // If no feeds found in HTML, try common paths
    if (feeds.length === 0) {
      for (const path of COMMON_FEED_PATHS) {
        try {
          const feedUrl = new URL(path, url.origin).href;
          const feedResponse = await fetch(feedUrl, {
            method: "HEAD",
            headers: { "User-Agent": "Void Feed RSS Detector/1.0" },
            redirect: "follow",
          });

          if (feedResponse.ok) {
            const contentType = feedResponse.headers.get("content-type") || "";
            if (
              contentType.includes("xml") ||
              contentType.includes("rss") ||
              contentType.includes("atom")
            ) {
              feeds.push({
                title: "RSS Feed",
                url: feedUrl,
                type: "rss",
              });
              break; // Found one, stop searching
            }
          }
        } catch {
          // Ignore errors for common paths
        }
      }
    }

    // Extract site title from HTML if possible
    let siteTitle = url.hostname;
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      siteTitle = titleTagMatch[1].trim();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: url.href,
        siteTitle,
        feeds,
        found: feeds.length > 0,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch URL",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
