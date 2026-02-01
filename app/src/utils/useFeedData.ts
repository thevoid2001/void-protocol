import { useState, useEffect, useCallback } from "react";
import type {
  FeedData,
  Topic,
  Source,
  SavedArticle,
  FeedSettings,
} from "./feedStorage.ts";
import {
  loadFeedData,
  saveFeedData,
  addTopic,
  updateTopic,
  deleteTopic,
  addSource,
  removeSource,
  moveSourceToTopic,
  saveArticle,
  unsaveArticle,
  isArticleSaved,
  updateSettings,
  exportOPML,
  importOPML,
} from "./feedStorage.ts";

export function useFeedData() {
  const [data, setData] = useState<FeedData>(loadFeedData);

  // Persist changes to localStorage
  useEffect(() => {
    saveFeedData(data);
  }, [data]);

  // Topic operations
  const createTopic = useCallback((name: string) => {
    setData((prev) => addTopic(prev, name));
  }, []);

  const renameTopic = useCallback((topicId: string, name: string) => {
    setData((prev) => updateTopic(prev, topicId, name));
  }, []);

  const removeTopic = useCallback((topicId: string) => {
    setData((prev) => deleteTopic(prev, topicId));
  }, []);

  // Source operations
  const createSource = useCallback(
    (source: Omit<Source, "id" | "addedAt">) => {
      setData((prev) => addSource(prev, source));
    },
    []
  );

  const deleteSource = useCallback((sourceId: string) => {
    setData((prev) => removeSource(prev, sourceId));
  }, []);

  const moveSource = useCallback((sourceId: string, topicId: string) => {
    setData((prev) => moveSourceToTopic(prev, sourceId, topicId));
  }, []);

  // Saved article operations
  const addSavedArticle = useCallback(
    (article: Omit<SavedArticle, "savedAt">) => {
      setData((prev) => saveArticle(prev, article));
    },
    []
  );

  const removeSavedArticle = useCallback((articleId: string) => {
    setData((prev) => unsaveArticle(prev, articleId));
  }, []);

  const checkArticleSaved = useCallback(
    (articleId: string) => {
      return isArticleSaved(data, articleId);
    },
    [data]
  );

  // Settings operations
  const setSettings = useCallback((settings: Partial<FeedSettings>) => {
    setData((prev) => updateSettings(prev, settings));
  }, []);

  // OPML operations
  const doExportOPML = useCallback(() => {
    return exportOPML(data);
  }, [data]);

  const doImportOPML = useCallback((opmlString: string) => {
    const imported = importOPML(opmlString);
    setData((prev) => ({
      ...prev,
      topics: [...prev.topics, ...imported.topics],
      sources: [...prev.sources, ...imported.sources],
    }));
  }, []);

  return {
    // Data
    topics: data.topics,
    sources: data.sources,
    savedArticles: data.savedArticles,
    settings: data.settings,

    // Topic operations
    createTopic,
    renameTopic,
    removeTopic,

    // Source operations
    createSource,
    deleteSource,
    moveSource,

    // Saved article operations
    addSavedArticle,
    removeSavedArticle,
    checkArticleSaved,

    // Settings
    setSettings,

    // OPML
    exportOPML: doExportOPML,
    importOPML: doImportOPML,
  };
}

// Article fetching types
export interface Article {
  id: string;
  title: string;
  link: string;
  content: string | null;
  contentSnippet: string | null;
  publishedAt: number;
  author: string | null;
  // Added by frontend
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
}

export interface FetchedFeed {
  title: string;
  description: string | null;
  link: string | null;
  articles: Article[];
}

// Fetch articles from a single source
export async function fetchFeed(source: Source): Promise<Article[]> {
  try {
    const response = await fetch(
      `/api/fetch?feed=${encodeURIComponent(source.feedUrl)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.articles || []).map((article: Omit<Article, "sourceName" | "sourceUrl" | "sourceId">) => ({
      ...article,
      sourceName: source.name,
      sourceUrl: source.siteUrl,
      sourceId: source.id,
    }));
  } catch (error) {
    console.error(`Failed to fetch ${source.feedUrl}:`, error);
    return [];
  }
}

// Fetch all feeds and merge into chronological list
export async function fetchAllFeeds(sources: Source[]): Promise<Article[]> {
  const results = await Promise.all(sources.map(fetchFeed));
  const allArticles = results.flat();

  // Sort by published date (newest first)
  allArticles.sort((a, b) => b.publishedAt - a.publishedAt);

  return allArticles;
}

// Search the feed index
export interface IndexedFeed {
  id: string;
  name: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
  keywords: string[];
  category: string;
}

export async function searchFeeds(query: string): Promise<IndexedFeed[]> {
  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.feeds || [];
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// Detect RSS feeds from a URL
export interface DetectedFeed {
  title: string;
  url: string;
  type: string;
}

export async function detectFeeds(
  url: string
): Promise<{ siteTitle: string; feeds: DetectedFeed[] }> {
  try {
    const response = await fetch(
      `/api/detect?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      siteTitle: data.siteTitle || url,
      feeds: data.feeds || [],
    };
  } catch (error) {
    console.error("Detection failed:", error);
    return { siteTitle: url, feeds: [] };
  }
}
