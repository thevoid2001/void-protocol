// Cloudflare Pages Function for RSS feed fetching

interface Article {
  id: string;
  title: string;
  link: string;
  content: string | null;
  contentSnippet: string | null;
  publishedAt: number;
  author: string | null;
}

// Simple XML tag extraction helper
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractCDATA(content: string): string {
  return content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(dateStr: string | null): number {
  if (!dateStr) return Date.now();
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? Date.now() : parsed;
}

function parseRSS(xml: string): { title: string; description: string | null; articles: Article[] } {
  const articles: Article[] = [];

  // Get channel info
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  const channelContent = channelMatch ? channelMatch[1] : xml;

  const feedTitle = extractTag(channelContent, "title") || "Unknown Feed";
  const feedDescription = extractTag(channelContent, "description");

  // Parse items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title = extractCDATA(extractTag(item, "title") || "Untitled");
    const link = extractTag(item, "link") || "";
    const guid = extractTag(item, "guid") || link || title;
    const content = extractTag(item, "content:encoded") || extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate") || extractTag(item, "dc:date");
    const author = extractTag(item, "dc:creator") || extractTag(item, "author");

    articles.push({
      id: guid,
      title,
      link,
      content: content ? extractCDATA(content) : null,
      contentSnippet: content ? stripHtml(extractCDATA(content)).slice(0, 200) : null,
      publishedAt: parseDate(pubDate),
      author: author ? extractCDATA(author) : null,
    });
  }

  return { title: feedTitle, description: feedDescription, articles };
}

function parseAtom(xml: string): { title: string; description: string | null; articles: Article[] } {
  const articles: Article[] = [];

  const feedTitle = extractTag(xml, "title") || "Unknown Feed";
  const feedDescription = extractTag(xml, "subtitle");

  // Parse entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const title = extractCDATA(extractTag(entry, "title") || "Untitled");

    // Get link href
    const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = linkMatch ? linkMatch[1] : "";

    const id = extractTag(entry, "id") || link || title;
    const content = extractTag(entry, "content") || extractTag(entry, "summary");
    const published = extractTag(entry, "published") || extractTag(entry, "updated");
    const authorName = entry.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/i);

    articles.push({
      id,
      title,
      link,
      content: content ? extractCDATA(content) : null,
      contentSnippet: content ? stripHtml(extractCDATA(content)).slice(0, 200) : null,
      publishedAt: parseDate(published),
      author: authorName ? authorName[1] : null,
    });
  }

  return { title: feedTitle, description: feedDescription, articles };
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const feedUrl = url.searchParams.get("feed");

  if (!feedUrl) {
    return new Response(
      JSON.stringify({ error: "Missing 'feed' parameter" }),
      { status: 400, headers }
    );
  }

  try {
    new URL(feedUrl);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid feed URL" }),
      { status: 400, headers }
    );
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Void Feed RSS Reader/1.0",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();

    // Determine if RSS or Atom
    const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"");
    const parsed = isAtom ? parseAtom(xml) : parseRSS(xml);

    // Sort by date and limit
    parsed.articles.sort((a, b) => b.publishedAt - a.publishedAt);
    parsed.articles = parsed.articles.slice(0, 50);

    return new Response(
      JSON.stringify({
        title: parsed.title,
        description: parsed.description,
        articles: parsed.articles,
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch or parse feed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers }
    );
  }
};
