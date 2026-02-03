import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PostCard, PostCardSkeleton, Post, truncateAddress, getWalletColor } from "../components/PostCard.tsx";
import { ComposePost } from "../components/ComposePost.tsx";
import { useFollowing } from "../hooks/useFollowing.ts";
import { useProfile } from "../hooks/useProfile.ts";

export function SocialProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { publicKey, connected } = useWallet();
  const { isFollowing, toggleFollow, loading: followLoading } = useFollowing();
  const { profile, loading: profileLoading, createProfile, updateProfile, creating, updating, hasProfile } = useProfile(address);
  const { profile: myProfile, createProfile: createMyProfile, hasProfile: iHaveProfile } = useProfile();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
              {hasProfile && (
                <p className="mt-1 text-xs text-[#505050]">
                  On-chain profile active
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwnProfile && connected && (
              <>
                {!hasProfile ? (
                  <button
                    onClick={createProfile}
                    disabled={creating}
                    className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Profile"}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="rounded-lg border border-void-border px-3 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
                  >
                    Settings
                  </button>
                )}
              </>
            )}
            {!isOwnProfile && connected && (
              <button
                onClick={() => toggleFollow(address)}
                disabled={followLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  following
                    ? "border border-void-accent text-void-accent hover:bg-void-accent/10"
                    : "bg-void-accent text-black hover:bg-void-accent/90"
                }`}
              >
                {followLoading ? "..." : following ? "Following" : "Follow"}
              </button>
            )}
            {!connected && <WalletMultiButton />}
          </div>
        </div>

        {/* On-chain stats */}
        {profile && (
          <div className="mt-6 flex items-center gap-6 border-t border-void-border pt-4">
            <div>
              <span className="text-lg font-semibold text-white">{posts.length}</span>
              <span className="ml-1 text-sm text-[#888888]">posts</span>
            </div>
            {profile.followerCount > 0 && (
              <div>
                <span className="text-lg font-semibold text-white">{profile.followerCount}</span>
                <span className="ml-1 text-sm text-[#888888]">followers</span>
              </div>
            )}
            {profile.followingCount > 0 && (
              <div>
                <span className="text-lg font-semibold text-white">{profile.followingCount}</span>
                <span className="ml-1 text-sm text-[#888888]">following</span>
              </div>
            )}
            {profile.totalVouches > 0 && (
              <div>
                <span className="text-lg font-semibold text-white">{profile.totalVouches}</span>
                <span className="ml-1 text-sm text-[#888888]">vouches</span>
              </div>
            )}
          </div>
        )}

        {/* Stats without profile */}
        {!profile && (
          <div className="mt-6 flex items-center gap-6 border-t border-void-border pt-4">
            <div>
              <span className="text-lg font-semibold text-white">{posts.length}</span>
              <span className="ml-1 text-sm text-[#888888]">posts</span>
            </div>
          </div>
        )}

        {/* Profile settings panel */}
        {showSettings && isOwnProfile && hasProfile && profile && (
          <div className="mt-6 border-t border-void-border pt-4">
            <p className="mb-4 text-xs text-[#888888] uppercase tracking-wider">
              Profile Settings
            </p>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-white">Show reputation publicly</span>
                <button
                  onClick={() => updateProfile(!profile.reputationVisible, profile.allowFollowers)}
                  disabled={updating}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    profile.reputationVisible
                      ? "bg-void-accent text-black"
                      : "bg-void-surface text-[#888888]"
                  }`}
                >
                  {profile.reputationVisible ? "On" : "Off"}
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-white">Allow followers</span>
                <button
                  onClick={() => updateProfile(profile.reputationVisible, !profile.allowFollowers)}
                  disabled={updating}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    profile.allowFollowers
                      ? "bg-void-accent text-black"
                      : "bg-void-surface text-[#888888]"
                  }`}
                >
                  {profile.allowFollowers ? "On" : "Off"}
                </button>
              </label>
            </div>
            {updating && (
              <p className="mt-3 text-xs text-void-accent animate-pulse">
                Updating on-chain...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create profile prompt for own profile */}
      {isOwnProfile && connected && !hasProfile && !profileLoading && (
        <div className="mb-6 rounded-lg border border-void-accent/30 bg-void-accent/5 p-4">
          <p className="text-sm text-void-accent">
            Create your on-chain profile to enable followers and track your reputation.
          </p>
        </div>
      )}

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
