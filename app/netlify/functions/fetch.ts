import type { Handler, HandlerEvent } from "@netlify/functions";
import Parser from "rss-parser";

interface Article {
  id: string;
  title: string;
  link: string;
  content: string | null;
  contentSnippet: string | null;
  publishedAt: number;
  author: string | null;
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Void Feed RSS Reader/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // Cache for 5 minutes
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const feedUrl = event.queryStringParameters?.feed;

  if (!feedUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing 'feed' parameter" }),
    };
  }

  // Validate URL
  try {
    new URL(feedUrl);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid feed URL" }),
    };
  }

  try {
    const feed = await parser.parseURL(feedUrl);

    const articles: Article[] = (feed.items || []).slice(0, 50).map((item) => ({
      id: item.guid || item.link || item.title || String(Date.now()),
      title: item.title || "Untitled",
      link: item.link || "",
      content: item.content || item["content:encoded"] || null,
      contentSnippet: item.contentSnippet || item.summary || null,
      publishedAt: item.pubDate
        ? new Date(item.pubDate).getTime()
        : item.isoDate
          ? new Date(item.isoDate).getTime()
          : Date.now(),
      author: item.creator || item.author || null,
    }));

    // Sort by date (newest first)
    articles.sort((a, b) => b.publishedAt - a.publishedAt);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: feed.title || "Unknown Feed",
        description: feed.description || null,
        link: feed.link || null,
        lastBuildDate: feed.lastBuildDate || null,
        articles,
      }),
    };
  } catch (error) {
    console.error("Feed fetch error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch or parse feed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
