import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ComposePost } from "../components/ComposePost.tsx";
import { PostCard, PostCardSkeleton, Post, truncateAddress, getWalletColor } from "../components/PostCard.tsx";
import { useFollowing } from "../hooks/useFollowing.ts";

type TimelineTab = "all" | "following";

// Keyboard shortcuts
const SHORTCUTS = {
  j: "Next post",
  k: "Previous post",
  v: "Vouch for post",
  "?": "Show shortcuts",
};

export function SocialPage() {
  const { connected, publicKey } = useWallet();
  const { following, followingCount } = useFollowing();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeTab, setActiveTab] = useState<TimelineTab>("all");
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);

  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // Fetch posts based on active tab
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/posts";

      if (activeTab === "following" && following.length > 0) {
        url = `/api/posts?authors=${following.join(",")}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch posts:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, following]);

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
          setReplyingTo(null);
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
            {connected && publicKey && (
              <Link
                to={`/social/${publicKey.toBase58()}`}
                className="flex items-center gap-2 rounded-lg border border-void-border px-3 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
              >
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${getWalletColor(publicKey.toBase58())}20` }}
                >
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: getWalletColor(publicKey.toBase58()) }}
                  >
                    {publicKey.toBase58().slice(0, 2)}
                  </span>
                </div>
                <span>My Profile</span>
              </Link>
            )}
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

      {/* Timeline tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-void-border">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-[1px] ${
            activeTab === "all"
              ? "border-void-accent text-white"
              : "border-transparent text-[#888888] hover:text-white"
          }`}
        >
          For You
        </button>
        <button
          onClick={() => setActiveTab("following")}
          className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-[1px] flex items-center gap-2 ${
            activeTab === "following"
              ? "border-void-accent text-white"
              : "border-transparent text-[#888888] hover:text-white"
          }`}
        >
          Following
          {followingCount > 0 && (
            <span className="rounded-full bg-void-surface px-2 py-0.5 text-xs">
              {followingCount}
            </span>
          )}
        </button>
      </div>

      {/* Connect prompt for non-connected users */}
      {!connected && (
        <div className="mb-6 rounded-lg border border-void-accent/30 bg-void-accent/5 p-4">
          <p className="text-sm text-void-accent">
            Connect your wallet to post and vouch. Your wallet is your identity.
          </p>
        </div>
      )}

      {/* Following empty state */}
      {activeTab === "following" && followingCount === 0 && !loading && (
        <div className="mb-6 rounded-lg border border-void-border p-6 text-center">
          <div className="mb-3 text-3xl">👥</div>
          <p className="text-[#888888]">You're not following anyone yet</p>
          <p className="mt-1 text-xs text-[#505050]">
            Visit profiles and follow wallets to see their posts here.
          </p>
          <button
            onClick={() => setActiveTab("all")}
            className="mt-4 text-sm text-void-accent hover:underline"
          >
            Browse all posts →
          </button>
        </div>
      )}

      {/* Reply composer */}
      {replyingTo && (
        <div className="mb-6">
          <ComposePost
            replyTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onPostCreated={() => {
              setReplyingTo(null);
              fetchPosts();
            }}
          />
        </div>
      )}

      {/* Compose (only show when not replying) */}
      {connected && !replyingTo && (
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
            <h2 className="mb-2 text-lg font-medium text-white">
              {activeTab === "following" ? "No posts from people you follow" : "No posts yet"}
            </h2>
            <p className="text-sm text-[#888888]">
              {connected
                ? activeTab === "following"
                  ? "Follow more wallets to see their posts here."
                  : "Be the first to post something."
                : "Connect your wallet to start the conversation."}
            </p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} ref={(el) => (itemRefs.current[index] = el)}>
              <PostCard
                post={post}
                isSelected={selectedIndex === index}
                onReply={connected ? setReplyingTo : undefined}
              />
            </div>
          ))
        )}
      </div>

      {/* Post count */}
      {!loading && posts.length > 0 && (
        <p className="mt-8 text-center text-xs text-[#505050]">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
          {activeTab === "following" && ` from ${followingCount} wallet${followingCount !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Following list (quick access) */}
      {activeTab === "following" && followingCount > 0 && !loading && (
        <div className="mt-8 border-t border-void-border pt-6">
          <p className="mb-3 text-xs text-[#505050] uppercase tracking-wider">
            Following ({followingCount})
          </p>
          <div className="flex flex-wrap gap-2">
            {following.slice(0, 10).map((address) => (
              <Link
                key={address}
                to={`/social/${address}`}
                className="flex items-center gap-2 rounded-full border border-void-border px-3 py-1.5 text-xs transition hover:border-[#888888]"
              >
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: `${getWalletColor(address)}40` }}
                />
                <span className="font-mono text-[#888888]">
                  {truncateAddress(address)}
                </span>
              </Link>
            ))}
            {followingCount > 10 && (
              <span className="px-3 py-1.5 text-xs text-[#505050]">
                +{followingCount - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* How it works — cypherpunk explainer */}
      <div className="mt-20 border-t border-void-border pt-12">
        <p className="mb-6 font-mono text-xs tracking-widest text-[#888888] uppercase">
          // How it works
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-white">
          <p>
            <span className="text-cyan-400">Void Social</span> is a decentralized message board
            where your wallet is your identity. No usernames. No passwords. No email verification.
            Just cryptographic proof that you are who you say you are.
          </p>

          <p>
            Every post is <span className="text-cyan-400">signed with your wallet</span>—a
            cryptographic signature that proves authorship without revealing anything else about
            you. Your pseudonymous identity is unforgeable and self-sovereign.
          </p>

          <p>
            There is no algorithm deciding what you see. Posts appear in
            <span className="text-cyan-400"> chronological order</span>. No engagement farming,
            no outrage amplification, no attention manipulation. The timeline is neutral.
          </p>

          <p>
            When you <span className="text-cyan-400">vouch</span> for a post, you stake your
            reputation on-chain. Real signal from real wallets. No bots. No sock puppets.
            Just cryptographic attestations of value.
          </p>
        </div>

        <p className="mt-8 font-mono text-xs text-[#888888]">
          "Privacy is necessary for an open society in the electronic age. Privacy is not secrecy...
          Privacy is the power to selectively reveal oneself to the world."
        </p>
        <p className="mt-2 font-mono text-xs text-[#666666]">
          — Eric Hughes, A Cypherpunk's Manifesto, 1993
        </p>
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
