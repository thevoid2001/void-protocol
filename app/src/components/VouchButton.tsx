import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";

interface VouchButtonProps {
  articleUrl: string;
  articleTitle: string;
  showCount?: boolean;
}

// Hash a string to get content_hash for the vouch
async function hashUrl(url: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

// Fetch vouch count from API
async function fetchVouchCount(articleUrl: string): Promise<number> {
  try {
    const response = await fetch(`/api/vouches?url=${encodeURIComponent(articleUrl)}`);
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
  } catch (e) {
    console.error("Failed to fetch vouch count:", e);
  }
  return 0;
}

export function VouchButton({ articleUrl, articleTitle, showCount = true }: VouchButtonProps) {
  const [vouched, setVouched] = useState(false);
  const [vouchCount, setVouchCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  // Check if user has already vouched and get count
  const checkVouchStatus = useCallback(async () => {
    setChecking(true);

    // Fetch count (works without wallet)
    if (showCount) {
      const count = await fetchVouchCount(articleUrl);
      setVouchCount(count);
    }

    // Check if current user vouched
    if (anchorWallet) {
      try {
        const contentHash = await hashUrl(articleUrl);
        const [vouchPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("vouch"),
            anchorWallet.publicKey.toBuffer(),
            Buffer.from(contentHash),
          ],
          PROGRAM_ID
        );

        const info = await connection.getAccountInfo(vouchPDA);
        setVouched(info !== null);
      } catch (e) {
        console.error("Error checking vouch:", e);
      }
    }

    setChecking(false);
  }, [anchorWallet, connection, articleUrl, showCount]);

  useEffect(() => {
    checkVouchStatus();
  }, [checkVouchStatus]);

  // Vouch for the article
  const handleVouch = async () => {
    if (!anchorWallet) return;

    setLoading(true);
    try {
      const program = getProgram(anchorWallet);
      const contentHash = await hashUrl(articleUrl);

      const [vouchPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vouch"),
          anchorWallet.publicKey.toBuffer(),
          Buffer.from(contentHash),
        ],
        PROGRAM_ID
      );

      await program.methods
        .vouch(Array.from(contentHash) as number[] & { length: 32 })
        .accounts({
          vouch: vouchPDA,
          voucher: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setVouched(true);
      setVouchCount((prev) => prev + 1);
    } catch (e) {
      console.error("Vouch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Unvouch (remove vouch)
  const handleUnvouch = async () => {
    if (!anchorWallet) return;

    setLoading(true);
    try {
      const program = getProgram(anchorWallet);
      const contentHash = await hashUrl(articleUrl);

      const [vouchPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vouch"),
          anchorWallet.publicKey.toBuffer(),
          Buffer.from(contentHash),
        ],
        PROGRAM_ID
      );

      await program.methods
        .unvouch()
        .accounts({
          vouch: vouchPDA,
          voucher: anchorWallet.publicKey,
        })
        .rpc();

      setVouched(false);
      setVouchCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Unvouch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Show count even without wallet connected
  if (!anchorWallet) {
    if (showCount && vouchCount > 0) {
      return (
        <div className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#505050]">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{vouchCount}</span>
        </div>
      );
    }
    return null;
  }

  if (checking) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#505050]"
      >
        <span className="animate-pulse">...</span>
      </button>
    );
  }

  return (
    <button
      onClick={vouched ? handleUnvouch : handleVouch}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
        vouched
          ? "bg-void-accent/20 text-void-accent"
          : "text-[#505050] hover:bg-void-accent/10 hover:text-void-accent"
      } disabled:opacity-50`}
      title={vouched ? "Remove vouch" : `Vouch for "${articleTitle}"`}
    >
      {loading ? (
        <span className="animate-spin">↻</span>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          fill={vouched ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      <span>{vouched ? "Vouched" : "Vouch"}</span>
      {vouchCount > 0 && <span className="text-[#888888]">({vouchCount})</span>}
    </button>
  );
}

// Standalone count display (for showing without wallet)
export function VouchCount({ articleUrl }: { articleUrl: string }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVouchCount(articleUrl).then((c) => {
      setCount(c);
      setLoading(false);
    });
  }, [articleUrl]);

  if (loading || count === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-[#888888]">
      <svg
        className="h-3 w-3"
        fill="currentColor"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span>{count} vouched</span>
    </div>
  );
}
