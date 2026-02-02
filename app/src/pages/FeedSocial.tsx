import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ComposePost } from "../components/ComposePost.tsx";
import { PostCard, PostCardSkeleton, Post } from "../components/PostCard.tsx";
import { VouchButton, VouchCount } from "../components/VouchButton.tsx";
import { TipButton } from "../components/TipButton.tsx";

type FeedItem =
  | { type: "post"; data: Post }
  | { type: "article"; data: Article };

interface Article {
  id: string;
  title: string;
  link: string;
  publishedAt: number;
  contentSnippet?: string;
  sourceName: string;
  sourceUrl: string;
}

// Keyboard shortcuts
const SHORTCUTS = {
  j: "Next item",
  k: "Previous item",
  o: "Open in new tab",
  v: "Vouch",
  "/": "Focus search",
  "?": "Show shortcuts",
};

export function FeedSocialPage() {
  const { connected } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tab, setTab] = useState<"all" | "posts" | "articles">("all");

  const feedRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/posts");
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch posts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Combine posts into feed items
  const feedItems: FeedItem[] = posts.map((post) => ({
    type: "post" as const,
    data: post,
  }));

  // Filter by tab
  const filteredItems = feedItems.filter((item) => {
    if (tab === "all") return true;
    return item.type === tab.slice(0, -1); // "posts" -> "post"
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredItems.length - 1)
          );
          break;
        case "k":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "o":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
            const item = filteredItems[selectedIndex];
            if (item.type === "article") {
              window.open(item.data.link, "_blank");
            }
          }
          break;
        case "/":
          e.preventDefault();
          // Focus search input if we had one
          break;
        case "?":
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
          break;
        case "Escape":
          setShowShortcuts(false);
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Social</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/feed"
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Discover
          </Link>
          <button
            onClick={() => setShowShortcuts(true)}
            className="rounded-lg border border-void-border px-3 py-2 text-sm text-[#505050] transition hover:border-[#888888] hover:text-white"
            title="Keyboard shortcuts (?)"
          >
            <kbd>?</kbd>
          </button>
          {!connected && <WalletMultiButton />}
        </div>
      </div>

      {/* Compose */}
      {connected && (
        <div className="mb-6">
          <ComposePost onPostCreated={fetchPosts} />
        </div>
      )}

      {/* Tab selector */}
      <div className="mb-6 flex gap-2 border-b border-void-border">
        {(["all", "posts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSelectedIndex(-1);
            }}
            className={`border-b-2 px-4 py-2 text-sm transition ${
              tab === t
                ? "border-void-accent text-white"
                : "border-transparent text-[#888888] hover:text-white"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div ref={feedRef} className="space-y-4">
        {loading ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-void-border p-8 text-center">
            <div className="mb-4 text-4xl">✍️</div>
            <p className="text-[#888888]">
              {connected
                ? "No posts yet. Be the first to post!"
                : "Connect your wallet to post and join the conversation."}
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div
              key={item.type === "post" ? item.data.id : item.data.id}
              ref={(el) => (itemRefs.current[index] = el)}
            >
              {item.type === "post" ? (
                <PostCard
                  post={item.data}
                  isSelected={selectedIndex === index}
                />
              ) : (
                <article
                  className={`group rounded-lg border p-4 transition ${
                    selectedIndex === index
                      ? "border-void-accent bg-void-accent/5"
                      : "border-void-border hover:border-[#333]"
                  }`}
                >
                  <a
                    href={item.data.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <h2 className="mb-1 text-base font-medium leading-snug text-white group-hover:text-void-accent">
                      {item.data.title}
                    </h2>
                    <p className="mb-2 text-xs text-[#888888]">
                      {item.data.sourceName} · {formatTime(item.data.publishedAt)}
                    </p>
                    {item.data.contentSnippet && (
                      <p className="text-sm leading-relaxed text-[#888888] line-clamp-2">
                        {item.data.contentSnippet}
                      </p>
                    )}
                  </a>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <TipButton
                      articleUrl={item.data.link}
                      authorName={item.data.sourceName}
                    />
                    {connected ? (
                      <VouchButton
                        articleUrl={item.data.link}
                        articleTitle={item.data.title}
                      />
                    ) : (
                      <VouchCount articleUrl={item.data.link} />
                    )}
                  </div>
                </article>
              )}
            </div>
          ))
        )}
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-void-border bg-void-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#888888] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(SHORTCUTS).map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-[#888888]">{desc}</span>
                  <kbd className="rounded bg-void-surface px-2 py-1 font-mono text-xs text-white">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-[#505050]">
              Press <kbd className="rounded bg-void-surface px-1">Esc</kbd> to
              deselect
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
