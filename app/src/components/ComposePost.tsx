import { useState, useCallback } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

interface ComposePostProps {
  onPostCreated?: () => void;
}

const MAX_LENGTH = 500;

export function ComposePost({ onPostCreated }: ComposePostProps) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchorWallet = useAnchorWallet();

  const handlePost = useCallback(async () => {
    if (!anchorWallet || !content.trim()) return;

    setPosting(true);
    setError(null);

    try {
      // Create the post payload
      const payload = {
        content: content.trim(),
        author: anchorWallet.publicKey.toBase58(),
        timestamp: Date.now(),
      };

      // Sign the payload to prove ownership
      const message = new TextEncoder().encode(JSON.stringify(payload));
      const signature = await anchorWallet.signMessage?.(message);

      if (!signature) {
        // Fallback: some wallets don't support signMessage
        // We'll still post but mark as unverified
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
      onPostCreated?.();
    } catch (e) {
      console.error("Post failed:", e);
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [anchorWallet, content, onPostCreated]);

  if (!anchorWallet) {
    return null;
  }

  const remaining = MAX_LENGTH - content.length;
  const isOverLimit = remaining < 0;

  return (
    <div className="rounded-lg border border-void-border bg-void-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-void-accent/20 flex items-center justify-center">
          <span className="text-xs font-mono text-void-accent">
            {anchorWallet.publicKey.toBase58().slice(0, 2)}
          </span>
        </div>
        <span className="text-sm font-mono text-[#888888]">
          {anchorWallet.publicKey.toBase58().slice(0, 4)}...
          {anchorWallet.publicKey.toBase58().slice(-4)}
        </span>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
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

        <button
          onClick={handlePost}
          disabled={posting || !content.trim() || isOverLimit}
          className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>

      <p className="mt-3 text-xs text-[#505050]">
        Posts are signed with your wallet. Text only, no images.
      </p>
    </div>
  );
}
