import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PostCard, PostCardSkeleton, Post, truncateAddress, getWalletColor } from "../components/PostCard.tsx";
import { ComposePost } from "../components/ComposePost.tsx";
import { useFollowing } from "../hooks/useFollowing.ts";

export function SocialProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { publicKey, connected } = useWallet();
  const { isFollowing, toggleFollow } = useFollowing();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);

  const isOwnProfile = publicKey?.toBase58() === address;

  // Fetch posts for this wallet
  const fetchPosts = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/posts?author=${address}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch posts:", e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (!address) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-center text-[#888888]">Invalid profile address</p>
      </div>
    );
  }

  const walletColor = getWalletColor(address);
  const following = isFollowing(address);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Back link */}
      <Link
        to="/social"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white"
      >
        ← Back to timeline
      </Link>

      {/* Profile header */}
      <div className="mb-8 rounded-lg border border-void-border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${walletColor}20` }}
            >
              <span
                className="text-2xl font-mono font-bold"
                style={{ color: walletColor }}
              >
                {address.slice(0, 2)}
              </span>
            </div>
            <div>
              <h1 className="font-mono text-lg text-white">
                {truncateAddress(address)}
              </h1>
              <p className="mt-1 font-mono text-xs text-[#505050] break-all">
                {address}
              </p>
              {isOwnProfile && (
                <p className="mt-2 text-xs text-void-accent">This is you</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOwnProfile && connected && (
              <button
                onClick={() => toggleFollow(address)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  following
                    ? "border border-void-accent text-void-accent hover:bg-void-accent/10"
                    : "bg-void-accent text-black hover:bg-void-accent/90"
                }`}
              >
                {following ? "Following" : "Follow"}
              </button>
            )}
            {!connected && <WalletMultiButton />}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex items-center gap-6 border-t border-void-border pt-4">
          <div>
            <span className="text-lg font-semibold text-white">{posts.length}</span>
            <span className="ml-1 text-sm text-[#888888]">posts</span>
          </div>
        </div>
      </div>

      {/* Reply composer (when replying) */}
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

      {/* Compose (only on own profile) */}
      {isOwnProfile && !replyingTo && (
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
            <div className="mb-4 text-5xl">📭</div>
            <h2 className="mb-2 text-lg font-medium text-white">No posts yet</h2>
            <p className="text-sm text-[#888888]">
              {isOwnProfile
                ? "Share your first thought with the void."
                : "This wallet hasn't posted anything yet."}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReply={connected ? setReplyingTo : undefined}
              showReplyContext={false}
            />
          ))
        )}
      </div>

      {/* Post count */}
      {!loading && posts.length > 0 && (
        <p className="mt-8 text-center text-xs text-[#505050]">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
