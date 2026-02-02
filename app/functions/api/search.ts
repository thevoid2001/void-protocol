// Cloudflare Pages Function for feed search
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

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.toLowerCase().trim();

  if (!query) {
    return new Response(
      JSON.stringify({ error: "Missing query parameter 'q'" }),
      { status: 400, headers }
    );
  }

  // Search feeds by name, description, keywords, and category
  const results = (feedIndex.feeds as Feed[]).filter((feed) => {
    const searchText = `${feed.name} ${feed.description} ${feed.keywords.join(" ")} ${feed.category}`.toLowerCase();
    return searchText.includes(query);
  });

  // Sort by relevance (name matches first)
  results.sort((a, b) => {
    const aNameMatch = a.name.toLowerCase().includes(query) ? 0 : 1;
    const bNameMatch = b.name.toLowerCase().includes(query) ? 0 : 1;
    return aNameMatch - bNameMatch;
  });

  const limitedResults = results.slice(0, 20);

  return new Response(
    JSON.stringify({
      query,
      count: limitedResults.length,
      total: results.length,
      feeds: limitedResults,
    }),
    { headers }
  );
};
