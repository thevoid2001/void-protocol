import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ComposePost } from "../components/ComposePost.tsx";
import { PostCard, PostCardSkeleton, Post } from "../components/PostCard.tsx";

// Keyboard shortcuts
const SHORTCUTS = {
  j: "Next post",
  k: "Previous post",
  v: "Vouch for post",
  "?": "Show shortcuts",
};

export function SocialPage() {
  const { connected } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, posts.length - 1));
          break;
        case "k":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
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
  }, [posts.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Void Social</h1>
            <p className="mt-1 text-sm text-[#888888]">
              Decentralized posts. Wallet-signed. No algorithm.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
      </div>

      {/* Connect prompt for non-connected users */}
      {!connected && (
        <div className="mb-6 rounded-lg border border-void-accent/30 bg-void-accent/5 p-4">
          <p className="text-sm text-void-accent">
            Connect your wallet to post and vouch. Your wallet is your identity.
          </p>
        </div>
      )}

      {/* Compose */}
      {connected && (
        <div className="mb-8">
          <ComposePost onPostCreated={fetchPosts} />
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4">
        {loading ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-void-border p-12 text-center">
            <div className="mb-4 text-5xl">✍️</div>
            <h2 className="mb-2 text-lg font-medium text-white">No posts yet</h2>
            <p className="text-sm text-[#888888]">
              {connected
                ? "Be the first to post something."
                : "Connect your wallet to start the conversation."}
            </p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} ref={(el) => (itemRefs.current[index] = el)}>
              <PostCard post={post} isSelected={selectedIndex === index} />
            </div>
          ))
        )}
      </div>

      {/* Post count */}
      {!loading && posts.length > 0 && (
        <p className="mt-8 text-center text-xs text-[#505050]">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      )}

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
