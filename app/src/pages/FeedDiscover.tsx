import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import feedIndex from "../data/feedIndex.json";
import {
  useFeedData,
  Article,
} from "../utils/useFeedData.ts";
import { VouchButton, VouchCount } from "../components/VouchButton.tsx";
import { TipButton } from "../components/TipButton.tsx";

interface IndexedFeed {
  id: string;
  name: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
  keywords: string[];
  category: string;
}

// Categories for quick browse
const CATEGORIES = [
  { id: "crypto", label: "Crypto", icon: "₿" },
  { id: "tech", label: "Tech", icon: "💻" },
  { id: "news", label: "News", icon: "📰" },
  { id: "finance", label: "Finance", icon: "📈" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "science", label: "Science", icon: "🔬" },
  { id: "gaming", label: "Gaming", icon: "🎮" },
  { id: "programming", label: "Dev", icon: "⌨️" },
];

export function FeedDiscoverPage() {
  const { sources, createSource, createTopic, topics } = useFeedData();
  const { connected } = useWallet();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedFeeds, setSearchedFeeds] = useState<IndexedFeed[]>([]);
  const [addedSourceIds, setAddedSourceIds] = useState<Set<string>>(
    new Set(sources.map(s => s.feedUrl))
  );

  // Search feeds and fetch their articles
  const searchAndFetch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setArticles([]);

    // Search the local feed index
    const searchLower = query.toLowerCase();
    const matchingFeeds = (feedIndex.feeds as IndexedFeed[]).filter((feed) => {
      const searchText = `${feed.name} ${feed.description} ${feed.keywords.join(" ")} ${feed.category}`.toLowerCase();
      return searchText.includes(searchLower);
    }).slice(0, 10); // Limit to 10 feeds for performance

    setSearchedFeeds(matchingFeeds);

    if (matchingFeeds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch articles from matching feeds
    const allArticles: Article[] = [];

    await Promise.all(
      matchingFeeds.map(async (feed) => {
        try {
          const response = await fetch(
            `/api/fetch?feed=${encodeURIComponent(feed.feedUrl)}`
          );
          if (response.ok) {
            const data = await response.json();
            const feedArticles = (data.articles || []).slice(0, 10).map((article: Omit<Article, "sourceName" | "sourceUrl" | "sourceId">) => ({
              ...article,
              sourceName: feed.name,
              sourceUrl: feed.siteUrl,
              sourceId: feed.id,
            }));
            allArticles.push(...feedArticles);
          }
        } catch (e) {
          console.error(`Failed to fetch ${feed.name}:`, e);
        }
      })
    );

    // Sort by date
    allArticles.sort((a, b) => b.publishedAt - a.publishedAt);
    setArticles(allArticles.slice(0, 50));
    setLoading(false);
  }, []);

  // Handle category click
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery(categoryId);
    searchAndFetch(categoryId);
  };

  // Handle search submit
  const handleSearch = () => {
    setSelectedCategory(null);
    searchAndFetch(searchQuery);
  };

  // Add a source to your feed
  const handleAddSource = (feed: IndexedFeed) => {
    // Create a default topic if none exists
    if (topics.length === 0) {
      createTopic("My Feeds");
    }

    createSource({
      topicId: topics[0]?.id || "",
      name: feed.name,
      feedUrl: feed.feedUrl,
      siteUrl: feed.siteUrl,
    });

    setAddedSourceIds(prev => new Set([...prev, feed.feedUrl]));
  };

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/feed/my"
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            My Feed
          </Link>
          {!connected && <WalletMultiButton />}
        </div>
      </div>

      {/* Vouch explainer when wallet connected */}
      {connected && articles.length === 0 && !loading && !searchQuery && (
        <div className="mb-6 rounded-lg border border-void-accent/30 bg-void-accent/5 p-4">
          <p className="text-sm text-void-accent">
            Wallet connected. You can now <strong>vouch</strong> for articles you find valuable.
          </p>
        </div>
      )}

      {/* Search bar */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search topics, sources, keywords..."
          className="flex-1 rounded-lg border border-void-border bg-void-surface px-4 py-3 text-white placeholder-[#505050] outline-none focus:border-void-accent"
          autoFocus
        />
        <button
          onClick={handleSearch}
          disabled={!searchQuery.trim() || loading}
          className="rounded-lg bg-void-accent px-6 py-3 font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {/* Category chips */}
      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              selectedCategory === cat.id
                ? "bg-void-accent text-black"
                : "border border-void-border text-[#888888] hover:border-[#888888] hover:text-white"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Sources found */}
      {searchedFeeds.length > 0 && !loading && (
        <div className="mb-6">
          <p className="mb-3 text-xs text-[#888888] uppercase tracking-wider">
            Sources ({searchedFeeds.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {searchedFeeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center gap-2 rounded-lg border border-void-border px-3 py-1.5"
              >
                <span className="text-sm text-white">{feed.name}</span>
                {addedSourceIds.has(feed.feedUrl) ? (
                  <span className="text-xs text-void-accent">✓</span>
                ) : (
                  <button
                    onClick={() => handleAddSource(feed)}
                    className="text-xs text-[#888888] hover:text-void-accent"
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
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
      )}

      {/* Articles */}
      {!loading && articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article) => (
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
              <div className="mt-3 flex items-center justify-end gap-2">
                <TipButton articleUrl={article.link} authorName={article.sourceName} />
                {connected ? (
                  <VouchButton articleUrl={article.link} articleTitle={article.title} />
                ) : (
                  <VouchCount articleUrl={article.link} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && searchedFeeds.length === 0 && searchQuery && (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <p className="text-[#888888]">No sources found for "{searchQuery}"</p>
          <p className="mt-2 text-sm text-[#505050]">
            Try a different keyword or browse the categories above.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!loading && articles.length === 0 && !searchQuery && (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <div className="mb-4 text-4xl">🔍</div>
          <p className="text-[#888888]">Search for any topic or click a category above</p>
          <p className="mt-2 text-sm text-[#505050]">
            We'll find articles from {feedIndex.feeds.length} sources
          </p>
        </div>
      )}

      {/* Stats */}
      {!loading && articles.length > 0 && (
        <p className="mt-8 text-center text-xs text-[#505050]">
          {articles.length} articles from {searchedFeeds.length} sources
        </p>
      )}
    </div>
  );
}
