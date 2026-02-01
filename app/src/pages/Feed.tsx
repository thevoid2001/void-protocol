import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  useFeedData,
  fetchAllFeeds,
  Article,
} from "../utils/useFeedData.ts";

export function FeedPage() {
  const {
    topics,
    sources,
    savedArticles,
    addSavedArticle,
    removeSavedArticle,
    checkArticleSaved,
  } = useFeedData();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch articles on mount and when sources change
  const loadArticles = useCallback(async () => {
    if (sources.length === 0) {
      setArticles([]);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    const fetched = await fetchAllFeeds(sources);
    setArticles(fetched);
    setLoading(false);
    setRefreshing(false);
  }, [sources]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Filter articles by topic
  const filteredArticles = selectedTopic
    ? articles.filter((article) => {
        const source = sources.find((s) => s.id === article.sourceId);
        return source?.topicId === selectedTopic;
      })
    : articles;

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Toggle save article
  const toggleSave = (article: Article) => {
    if (checkArticleSaved(article.id)) {
      removeSavedArticle(article.id);
    } else {
      addSavedArticle({
        id: article.id,
        title: article.title,
        link: article.link,
        content: article.content,
        contentSnippet: article.contentSnippet,
        sourceName: article.sourceName,
        sourceUrl: article.sourceUrl,
        publishedAt: article.publishedAt,
      });
    }
  };

  // Empty state when no sources
  if (sources.length === 0 && !loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-semibold">Void Feed</h1>
        <p className="mb-8 text-[#888888]">
          Your private RSS reader. No algorithms, no tracking, no bullshit.
        </p>

        <div className="rounded-lg border border-void-border p-8 text-center">
          <div className="mb-4 text-6xl opacity-30">📡</div>
          <h2 className="mb-2 text-lg font-medium">Your feed is empty</h2>
          <p className="mb-6 text-sm text-[#888888]">
            Add sources to get started. Search our index or paste any website URL.
          </p>
          <Link
            to="/feed/sources"
            className="inline-block rounded-lg bg-void-accent px-6 py-3 text-sm font-medium text-black transition hover:bg-void-accent/90"
          >
            Add Sources
          </Link>
        </div>

        {/* How it works section */}
        <div className="mt-16 border-t border-void-border pt-12">
          <p className="mb-6 font-mono text-xs tracking-widest text-[#888888] uppercase">
            // How it works
          </p>
          <div className="space-y-6 text-sm leading-relaxed text-white">
            <p>
              <span className="text-void-accent">You decide everything.</span>{" "}
              We make zero editorial choices. No recommendations, no trending,
              no algorithm deciding what you should see.
            </p>
            <p>
              <span className="text-void-accent">Chronological only.</span>{" "}
              Articles appear in the order they were published. Newest first.
              That's it.
            </p>
            <p>
              <span className="text-void-accent">Privacy first.</span>{" "}
              Everything is stored locally in your browser. No accounts, no
              cloud sync, no tracking, no analytics. Nothing leaves your device.
            </p>
            <p>
              <span className="text-void-accent">Your data, your way.</span>{" "}
              Export your subscriptions as OPML anytime. Import from other
              readers. You own your data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Void Feed</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={loadArticles}
            disabled={refreshing}
            className="rounded-lg border border-void-border p-2 text-[#888888] transition hover:border-[#888888] hover:text-white disabled:opacity-50"
            title="Refresh feeds"
          >
            <svg
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <Link
            to="/feed/saved"
            className="rounded-lg border border-void-border p-2 text-[#888888] transition hover:border-[#888888] hover:text-white"
            title="Saved articles"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </Link>
          <Link
            to="/feed/sources"
            className="rounded-lg border border-void-border p-2 text-[#888888] transition hover:border-[#888888] hover:text-white"
            title="Manage sources"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Topic tabs */}
      {topics.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedTopic(null)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${
              selectedTopic === null
                ? "bg-void-accent text-black"
                : "border border-void-border text-[#888888] hover:border-[#888888] hover:text-white"
            }`}
          >
            All
          </button>
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${
                selectedTopic === topic.id
                  ? "bg-void-accent text-black"
                  : "border border-void-border text-[#888888] hover:border-[#888888] hover:text-white"
              }`}
            >
              {topic.name}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-void-border p-4"
            >
              <div className="mb-2 h-5 w-3/4 rounded bg-void-surface"></div>
              <div className="mb-3 h-4 w-1/4 rounded bg-void-surface"></div>
              <div className="h-4 w-full rounded bg-void-surface"></div>
            </div>
          ))}
        </div>
      ) : (
        /* Article list */
        <div className="space-y-4">
          {filteredArticles.length === 0 ? (
            <div className="rounded-lg border border-void-border p-8 text-center">
              <p className="text-[#888888]">
                {selectedTopic
                  ? "No articles in this topic yet."
                  : "No articles to show."}
              </p>
            </div>
          ) : (
            filteredArticles.slice(0, 50).map((article) => (
              <article
                key={article.id}
                className="group rounded-lg border border-void-border p-4 transition hover:border-[#333]"
              >
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <h2 className="mb-1 text-base font-medium leading-snug text-white group-hover:text-void-accent">
                    {article.title}
                  </h2>
                  <p className="mb-2 text-xs text-[#888888]">
                    {article.sourceName} · {formatTime(article.publishedAt)}
                  </p>
                  {article.contentSnippet && (
                    <p className="text-sm leading-relaxed text-[#888888] line-clamp-2">
                      {article.contentSnippet}
                    </p>
                  )}
                </a>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => toggleSave(article)}
                    className={`rounded p-1.5 text-sm transition ${
                      checkArticleSaved(article.id)
                        ? "text-void-accent"
                        : "text-[#505050] hover:text-[#888888]"
                    }`}
                    title={checkArticleSaved(article.id) ? "Unsave" : "Save"}
                  >
                    <svg
                      className="h-4 w-4"
                      fill={checkArticleSaved(article.id) ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* Stats footer */}
      {!loading && articles.length > 0 && (
        <div className="mt-8 text-center text-xs text-[#505050]">
          {filteredArticles.length} articles from {sources.length} sources
        </div>
      )}
    </div>
  );
}
