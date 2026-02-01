import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import tipRegistry from "../data/tipRegistry.json";

interface TipButtonProps {
  articleUrl: string;
  authorName?: string;
}

interface RegisteredAuthor {
  domain?: string;
  subdomain?: string;
  name: string;
  wallet: string | null;
  verified: boolean;
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

// Check if URL is a Substack
function getSubstackSubdomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (hostname.endsWith(".substack.com")) {
      return hostname.replace(".substack.com", "");
    }
    return null;
  } catch {
    return null;
  }
}

// Find registered author for a URL
function findAuthor(url: string): RegisteredAuthor | null {
  const domain = getDomain(url);
  const substackSubdomain = getSubstackSubdomain(url);

  // Check substacks first
  if (substackSubdomain) {
    const substack = tipRegistry.substacks.find(
      (s) => s.subdomain === substackSubdomain && s.wallet
    );
    if (substack) return substack as RegisteredAuthor;
  }

  // Check domains
  const author = tipRegistry.authors.find(
    (a) => a.domain === domain && a.wallet
  );
  if (author) return author as RegisteredAuthor;

  return null;
}

const TIP_AMOUNTS = [
  { label: "0.01 SOL", value: 0.01 },
  { label: "0.05 SOL", value: 0.05 },
  { label: "0.1 SOL", value: 0.1 },
  { label: "0.5 SOL", value: 0.5 },
];

export function TipButton({ articleUrl, authorName }: TipButtonProps) {
  const [author, setAuthor] = useState<RegisteredAuthor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState(0.05);

  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  useEffect(() => {
    const found = findAuthor(articleUrl);
    setAuthor(found);
  }, [articleUrl]);

  const handleTip = useCallback(async () => {
    if (!anchorWallet || !author?.wallet) return;

    setSending(true);
    setError(null);

    try {
      const recipientPubkey = new PublicKey(author.wallet);
      const lamports = Math.floor(selectedAmount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: anchorWallet.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = anchorWallet.publicKey;

      const signed = await anchorWallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 2000);
    } catch (e) {
      console.error("Tip failed:", e);
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }, [anchorWallet, connection, author, selectedAmount]);

  // Don't show if no wallet connected or no author registered
  if (!anchorWallet || !author) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#505050] transition hover:bg-void-accent/10 hover:text-void-accent"
        title={`Tip ${author.name}`}
      >
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
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Tip</span>
      </button>

      {/* Tip Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !sending && setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-void-border bg-void-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center">
                <div className="mb-4 text-4xl">✓</div>
                <p className="text-lg font-medium text-void-accent">Tip sent!</p>
                <p className="mt-2 text-sm text-[#888888]">
                  {selectedAmount} SOL to {author.name}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Tip {authorName || author.name}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-[#888888] hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <p className="mb-4 text-sm text-[#888888]">
                  Send SOL directly to the author. No fees, no middleman.
                </p>

                {/* Amount selection */}
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {TIP_AMOUNTS.map((amount) => (
                    <button
                      key={amount.value}
                      onClick={() => setSelectedAmount(amount.value)}
                      className={`rounded-lg border py-2 text-sm transition ${
                        selectedAmount === amount.value
                          ? "border-void-accent bg-void-accent/10 text-void-accent"
                          : "border-void-border text-[#888888] hover:border-[#888888]"
                      }`}
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>

                {/* Recipient info */}
                <div className="mb-4 rounded-lg bg-void-surface p-3">
                  <p className="text-xs text-[#888888]">Sending to:</p>
                  <p className="text-sm font-medium">{author.name}</p>
                  <p className="mt-1 truncate font-mono text-xs text-[#505050]">
                    {author.wallet}
                  </p>
                  {author.verified && (
                    <p className="mt-1 text-xs text-void-accent">✓ Verified</p>
                  )}
                </div>

                {error && (
                  <div className="mb-4 rounded border border-void-error/30 bg-void-error/5 p-3 text-sm text-void-error">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleTip}
                  disabled={sending}
                  className="w-full rounded-lg bg-void-accent py-3 font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
                >
                  {sending ? "Sending..." : `Send ${selectedAmount} SOL`}
                </button>

                <p className="mt-3 text-center text-xs text-[#505050]">
                  Transaction on Solana devnet
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Show "Register for tips" link for unregistered authors
export function TipRegistrationPrompt({ articleUrl }: { articleUrl: string }) {
  const domain = getDomain(articleUrl);
  const substackSubdomain = getSubstackSubdomain(articleUrl);
  const author = findAuthor(articleUrl);

  // Don't show if already registered
  if (author) return null;

  // Only show for substacks (where authors might want to register)
  if (!substackSubdomain) return null;

  return (
    <a
      href="https://github.com/thevoid2001/void-protocol#tip-registry"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-[#505050] hover:text-void-accent"
      title="Authors: register your wallet to receive tips"
    >
      Enable tips
    </a>
  );
}
