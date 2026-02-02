import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VouchButton, VouchCount } from "./VouchButton.tsx";
import { TipButton } from "./TipButton.tsx";

export interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  signature: string | null;
  verified: boolean;
}

interface PostCardProps {
  post: Post;
  isSelected?: boolean;
}

// Format relative time
function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

// Truncate wallet address
function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Generate a consistent color from wallet address
function getWalletColor(address: string): string {
  const colors = [
    "#00D1FF", // cyan
    "#FF6B6B", // coral
    "#4ECDC4", // teal
    "#FFE66D", // yellow
    "#95E1D3", // mint
    "#F38181", // salmon
    "#AA96DA", // lavender
    "#FCBAD3", // pink
  ];

  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function PostCard({ post, isSelected }: PostCardProps) {
  const { connected } = useWallet();
  const [showFullAddress, setShowFullAddress] = useState(false);

  // Create a unique URL for this post (for vouching)
  const postUrl = `void://post/${post.id}`;
  const walletColor = getWalletColor(post.author);

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        isSelected
          ? "border-void-accent bg-void-accent/5"
          : "border-void-border hover:border-[#333]"
      }`}
    >
      {/* Author header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${walletColor}20` }}
        >
          <span
            className="text-xs font-mono font-medium"
            style={{ color: walletColor }}
          >
            {post.author.slice(0, 2)}
          </span>
        </div>

        <div className="flex-1">
          <button
            onClick={() => setShowFullAddress(!showFullAddress)}
            className="font-mono text-sm text-white hover:text-void-accent"
          >
            {showFullAddress ? post.author : truncateAddress(post.author)}
          </button>
          <div className="flex items-center gap-2 text-xs text-[#505050]">
            <span>{formatTime(post.timestamp)}</span>
            {post.verified && (
              <span className="text-void-accent" title="Signature verified">
                ✓ signed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[#e0e0e0]">
        {post.content}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {connected ? (
          <>
            <TipButton articleUrl={postUrl} authorName={truncateAddress(post.author)} />
            <VouchButton articleUrl={postUrl} articleTitle={`Post by ${truncateAddress(post.author)}`} />
          </>
        ) : (
          <VouchCount articleUrl={postUrl} />
        )}
      </div>
    </article>
  );
}

// Skeleton loader for posts
export function PostCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-void-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-void-surface" />
        <div className="flex-1">
          <div className="mb-1 h-4 w-24 rounded bg-void-surface" />
          <div className="h-3 w-16 rounded bg-void-surface" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-void-surface" />
        <div className="h-4 w-3/4 rounded bg-void-surface" />
      </div>
    </div>
  );
}
