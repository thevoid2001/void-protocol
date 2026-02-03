import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PostCard, PostCardSkeleton, Post } from "../components/PostCard.tsx";
import { ComposePost } from "../components/ComposePost.tsx";

export function SocialPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { connected } = useWallet();

  const [post, setPost] = useState<Post | null>(null);
  const [parentPost, setParentPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);

  // Fetch the post and its replies
  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setLoading(true);
    try {
      // Fetch main post
      const postResponse = await fetch(`/api/posts?id=${postId}`);
      if (postResponse.ok) {
        const postData = await postResponse.json();
        setPost(postData.post || null);

        // If this post is a reply, fetch the parent
        if (postData.post?.replyTo) {
          const parentResponse = await fetch(`/api/posts?id=${postData.post.replyTo}`);
          if (parentResponse.ok) {
            const parentData = await parentResponse.json();
            setParentPost(parentData.post || null);
          }
        }
      }

      // Fetch replies
      const repliesResponse = await fetch(`/api/posts?replyTo=${postId}`);
      if (repliesResponse.ok) {
        const repliesData = await repliesResponse.json();
        setReplies(repliesData.posts || []);
      }
    } catch (e) {
      console.error("Failed to fetch post:", e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/social"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white"
        >
          ← Back to timeline
        </Link>
        <PostCardSkeleton />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/social"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white"
        >
          ← Back to timeline
        </Link>
        <div className="rounded-lg border border-void-border p-12 text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h2 className="mb-2 text-lg font-medium text-white">Post not found</h2>
          <p className="text-sm text-[#888888]">
            This post may have been deleted or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/social"
          className="inline-flex items-center gap-2 text-sm text-[#888888] hover:text-white"
        >
          ← Back to timeline
        </Link>
        {!connected && <WalletMultiButton />}
      </div>

      {/* Parent post (if this is a reply) */}
      {parentPost && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-[#505050] uppercase tracking-wider">
            Original post
          </p>
          <PostCard post={parentPost} compact />
          <div className="ml-4 h-4 border-l border-void-border" />
        </div>
      )}

      {/* Main post */}
      <div className="mb-6">
        <PostCard
          post={post}
          onReply={connected ? setReplyingTo : undefined}
          showReplyContext={false}
        />
      </div>

      {/* Reply composer */}
      {replyingTo ? (
        <div className="mb-6">
          <ComposePost
            replyTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onPostCreated={() => {
              setReplyingTo(null);
              fetchPost();
            }}
          />
        </div>
      ) : connected ? (
        <div className="mb-6">
          <ComposePost
            replyTo={post}
            onPostCreated={fetchPost}
          />
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-void-accent/30 bg-void-accent/5 p-4">
          <p className="text-sm text-void-accent">
            Connect your wallet to reply to this post.
          </p>
        </div>
      )}

      {/* Replies section */}
      {replies.length > 0 && (
        <div>
          <p className="mb-4 text-xs text-[#505050] uppercase tracking-wider">
            {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
          </p>
          <div className="space-y-4">
            {replies.map((reply) => (
              <PostCard
                key={reply.id}
                post={reply}
                onReply={connected ? setReplyingTo : undefined}
                showReplyContext={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* No replies */}
      {replies.length === 0 && (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <p className="text-[#888888]">No replies yet</p>
          <p className="mt-1 text-xs text-[#505050]">
            Be the first to respond to this post.
          </p>
        </div>
      )}
    </div>
  );
}
