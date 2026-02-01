import type { Handler, HandlerEvent } from "@netlify/functions";
import feedIndex from "../../src/data/feedIndex.json";

interface Feed {
  id: string;
  name: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
  keywords: string[];
  category: string;
}

const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const query = event.queryStringParameters?.q?.toLowerCase().trim();

  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing query parameter 'q'" }),
    };
  }

  // Search feeds by name, description, keywords, and category
  const results = (feedIndex.feeds as Feed[]).filter((feed) => {
    const searchText = `${feed.name} ${feed.description} ${feed.keywords.join(" ")} ${feed.category}`.toLowerCase();
    return searchText.includes(query);
  });

  // Sort by relevance (name matches first, then keyword matches)
  results.sort((a, b) => {
    const aNameMatch = a.name.toLowerCase().includes(query) ? 0 : 1;
    const bNameMatch = b.name.toLowerCase().includes(query) ? 0 : 1;
    return aNameMatch - bNameMatch;
  });

  // Limit results
  const limitedResults = results.slice(0, 20);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      query,
      count: limitedResults.length,
      total: results.length,
      feeds: limitedResults,
    }),
  };
};

export { handler };
