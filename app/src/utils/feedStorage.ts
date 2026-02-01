// Types for Void Feed local storage

export interface Topic {
  id: string;
  name: string;
  order: number;
}

export interface Source {
  id: string;
  topicId: string;
  name: string;
  feedUrl: string;
  siteUrl: string;
  icon?: string;
  addedAt: number;
}

export interface SavedArticle {
  id: string;
  title: string;
  link: string;
  content: string | null;
  contentSnippet: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: number;
  savedAt: number;
}

export interface FeedSettings {
  refreshInterval: number; // minutes
  articlesPerFeed: number;
}

export interface FeedData {
  topics: Topic[];
  sources: Source[];
  savedArticles: SavedArticle[];
  settings: FeedSettings;
}

const STORAGE_KEY = "void-feed-data";

const DEFAULT_DATA: FeedData = {
  topics: [],
  sources: [],
  savedArticles: [],
  settings: {
    refreshInterval: 30,
    articlesPerFeed: 30,
  },
};

// Load data from localStorage
export function loadFeedData(): FeedData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_DATA;
    const parsed = JSON.parse(stored) as Partial<FeedData>;
    return {
      ...DEFAULT_DATA,
      ...parsed,
    };
  } catch {
    return DEFAULT_DATA;
  }
}

// Save data to localStorage
export function saveFeedData(data: FeedData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Topic operations
export function addTopic(data: FeedData, name: string): FeedData {
  const newTopic: Topic = {
    id: generateId(),
    name,
    order: data.topics.length,
  };
  return {
    ...data,
    topics: [...data.topics, newTopic],
  };
}

export function updateTopic(data: FeedData, topicId: string, name: string): FeedData {
  return {
    ...data,
    topics: data.topics.map((t) =>
      t.id === topicId ? { ...t, name } : t
    ),
  };
}

export function deleteTopic(data: FeedData, topicId: string): FeedData {
  return {
    ...data,
    topics: data.topics.filter((t) => t.id !== topicId),
    sources: data.sources.filter((s) => s.topicId !== topicId),
  };
}

// Source operations
export function addSource(
  data: FeedData,
  source: Omit<Source, "id" | "addedAt">
): FeedData {
  const newSource: Source = {
    ...source,
    id: generateId(),
    addedAt: Date.now(),
  };
  return {
    ...data,
    sources: [...data.sources, newSource],
  };
}

export function removeSource(data: FeedData, sourceId: string): FeedData {
  return {
    ...data,
    sources: data.sources.filter((s) => s.id !== sourceId),
  };
}

export function moveSourceToTopic(
  data: FeedData,
  sourceId: string,
  topicId: string
): FeedData {
  return {
    ...data,
    sources: data.sources.map((s) =>
      s.id === sourceId ? { ...s, topicId } : s
    ),
  };
}

// Saved article operations
export function saveArticle(
  data: FeedData,
  article: Omit<SavedArticle, "savedAt">
): FeedData {
  // Check if already saved
  if (data.savedArticles.some((a) => a.id === article.id)) {
    return data;
  }
  const newArticle: SavedArticle = {
    ...article,
    savedAt: Date.now(),
  };
  return {
    ...data,
    savedArticles: [newArticle, ...data.savedArticles],
  };
}

export function unsaveArticle(data: FeedData, articleId: string): FeedData {
  return {
    ...data,
    savedArticles: data.savedArticles.filter((a) => a.id !== articleId),
  };
}

export function isArticleSaved(data: FeedData, articleId: string): boolean {
  return data.savedArticles.some((a) => a.id === articleId);
}

// Settings operations
export function updateSettings(
  data: FeedData,
  settings: Partial<FeedSettings>
): FeedData {
  return {
    ...data,
    settings: { ...data.settings, ...settings },
  };
}

// OPML Export
export function exportOPML(data: FeedData): string {
  const topicOutlines = data.topics
    .map((topic) => {
      const topicSources = data.sources.filter((s) => s.topicId === topic.id);
      const sourceOutlines = topicSources
        .map(
          (s) =>
            `      <outline type="rss" text="${escapeXml(s.name)}" xmlUrl="${escapeXml(s.feedUrl)}" htmlUrl="${escapeXml(s.siteUrl)}"/>`
        )
        .join("\n");
      return `    <outline text="${escapeXml(topic.name)}">\n${sourceOutlines}\n    </outline>`;
    })
    .join("\n");

  // Also include sources without topics
  const orphanSources = data.sources.filter(
    (s) => !data.topics.some((t) => t.id === s.topicId)
  );
  const orphanOutlines = orphanSources
    .map(
      (s) =>
        `    <outline type="rss" text="${escapeXml(s.name)}" xmlUrl="${escapeXml(s.feedUrl)}" htmlUrl="${escapeXml(s.siteUrl)}"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Void Feed Subscriptions</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${topicOutlines}
${orphanOutlines}
  </body>
</opml>`;
}

// OPML Import
export function importOPML(
  opmlString: string
): { topics: Topic[]; sources: Source[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opmlString, "text/xml");

  const topics: Topic[] = [];
  const sources: Source[] = [];

  // Get all top-level outlines in body
  const body = doc.querySelector("body");
  if (!body) return { topics, sources };

  const topOutlines = body.children;
  let topicOrder = 0;

  for (const outline of topOutlines) {
    if (outline.tagName !== "outline") continue;

    const type = outline.getAttribute("type");
    const xmlUrl = outline.getAttribute("xmlUrl");

    if (type === "rss" && xmlUrl) {
      // Direct feed, no topic
      sources.push({
        id: generateId(),
        topicId: "",
        name: outline.getAttribute("text") || outline.getAttribute("title") || "Untitled",
        feedUrl: xmlUrl,
        siteUrl: outline.getAttribute("htmlUrl") || "",
        addedAt: Date.now(),
      });
    } else {
      // This is a folder/topic
      const topicId = generateId();
      const topicName = outline.getAttribute("text") || outline.getAttribute("title") || "Untitled";

      topics.push({
        id: topicId,
        name: topicName,
        order: topicOrder++,
      });

      // Get child feeds
      const childOutlines = outline.querySelectorAll(":scope > outline");
      for (const child of childOutlines) {
        const childXmlUrl = child.getAttribute("xmlUrl");
        if (childXmlUrl) {
          sources.push({
            id: generateId(),
            topicId,
            name: child.getAttribute("text") || child.getAttribute("title") || "Untitled",
            feedUrl: childXmlUrl,
            siteUrl: child.getAttribute("htmlUrl") || "",
            addedAt: Date.now(),
          });
        }
      }
    }
  }

  return { topics, sources };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
