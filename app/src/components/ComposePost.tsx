import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { Post, truncateAddress, getWalletColor } from "./PostCard.tsx";

interface ComposePostProps {
  onPostCreated?: () => void;
  replyTo?: Post | null;
  onCancelReply?: () => void;
  autoFocus?: boolean;
}

const MAX_LENGTH = 500;

export function ComposePost({
  onPostCreated,
  replyTo,
  onCancelReply,
  autoFocus = false,
}: ComposePostProps) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { publicKey, signMessage, connected } = useWallet();

  // Focus textarea when replying
  useEffect(() => {
    if ((replyTo || autoFocus) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo, autoFocus]);

  const handlePost = useCallback(async () => {
    if (!publicKey || !content.trim()) return;

    setPosting(true);
    setError(null);

    try {
      // Create the post payload
      const payload = {
        content: content.trim(),
        author: publicKey.toBase58(),
        timestamp: Date.now(),
        replyTo: replyTo?.id || null,
      };

      // Sign the payload to prove ownership
      let signature: Uint8Array | null = null;
      if (signMessage) {
        try {
          const message = new TextEncoder().encode(JSON.stringify(payload));
          signature = await signMessage(message);
        } catch (e) {
          // Wallet doesn't support signMessage or user rejected
          console.log("Signing skipped:", e);
        }
      }

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          signature: signature ? bs58.encode(signature) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to post");
      }

      setContent("");
      onCancelReply?.();
      onPostCreated?.();
    } catch (e) {
      console.error("Post failed:", e);
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [publicKey, signMessage, content, replyTo, onPostCreated, onCancelReply]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to post
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && !posting && !isOverLimit) {
        handlePost();
      }
    }
    // Escape to cancel reply
    if (e.key === "Escape" && replyTo) {
      onCancelReply?.();
    }
  };

  if (!connected || !publicKey) {
    return null;
  }

  const remaining = MAX_LENGTH - content.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="rounded-lg border border-void-border bg-void-surface p-4">
      {/* Reply context */}
      {replyTo && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-void-bg/50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#505050]">Replying to</span>
            <span
              className="font-mono"
              style={{ color: getWalletColor(replyTo.author) }}
            >
              {truncateAddress(replyTo.author)}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="text-[#505050] hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-void-accent/20 flex items-center justify-center">
          <span className="text-xs font-mono text-void-accent">
            {publicKey.toBase58().slice(0, 2)}
          </span>
        </div>
        <span className="text-sm font-mono text-[#888888]">
          {publicKey.toBase58().slice(0, 4)}...
          {publicKey.toBase58().slice(-4)}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={replyTo ? "Write a reply..." : "What's on your mind?"}
        className="w-full resize-none rounded-lg border-none bg-transparent text-white placeholder-[#505050] outline-none"
        rows={3}
        maxLength={MAX_LENGTH + 50} // Allow typing over to show error
      />

      {error && (
        <div className="mt-2 text-sm text-void-error">{error}</div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`text-xs ${
            isOverLimit
              ? "text-void-error"
              : remaining < 50
              ? "text-yellow-500"
              : "text-[#505050]"
          }`}
        >
          {remaining}
        </span>

        <div className="flex items-center gap-2">
          {replyTo && (
            <button
              onClick={onCancelReply}
              className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handlePost}
            disabled={posting || !content.trim() || isOverLimit}
            className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
          >
            {posting ? "Posting..." : replyTo ? "Reply" : "Post"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-[#505050]">
        {replyTo ? "Press ⌘+Enter to reply, Esc to cancel" : "Posts are signed with your wallet. ⌘+Enter to post."}
      </p>
    </div>
  );
}
