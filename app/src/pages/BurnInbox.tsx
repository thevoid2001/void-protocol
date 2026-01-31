import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import {
  deriveEncryptionKeyPair,
  decryptWithDerivedKey,
  unpackPayload,
  parseSubmissionPayload,
  VOID_BURN_SIGN_MESSAGE,
  type SubmissionPayloadPlain,
} from "../utils/encryption.ts";
import { fetchFromArweave } from "../utils/arweave.ts";

interface MessageInfo {
  id: number;
  sender: string;
  arweaveHash: string;
  burnAfterReading: boolean;
  burned: boolean;
  timestamp: Date;
  decrypted?: SubmissionPayloadPlain;
}

export function BurnInboxPage() {
  const [inboxActive, setInboxActive] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [privateKey, setPrivateKey] = useState<JsonWebKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState<number | null>(null);
  const [burning, setBurning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const { connection } = useConnection();

  // Check inbox and fetch messages
  useEffect(() => {
    if (!anchorWallet) {
      setLoading(false);
      return;
    }

    const fetchInbox = async () => {
      setLoading(true);
      try {
        const program = getProgram(anchorWallet);
        const [inboxPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("inbox"), anchorWallet.publicKey.toBuffer()],
          PROGRAM_ID,
        );

        let inboxAccount;
        try {
          inboxAccount = await program.account.inbox.fetch(inboxPDA);
        } catch {
          setInboxActive(false);
          setLoading(false);
          return;
        }

        setInboxActive(true);
        const messageCount = (inboxAccount.messageCount as { toNumber: () => number }).toNumber();

        // Fetch all messages
        const msgs: MessageInfo[] = [];
        for (let i = 0; i < messageCount; i++) {
          try {
            const [msgPDA] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("dm"),
                anchorWallet.publicKey.toBuffer(),
                Buffer.from(new Uint8Array(new BigInt64Array([BigInt(i)]).buffer)),
              ],
              PROGRAM_ID,
            );

            const msg = await program.account.directMessage.fetch(msgPDA);
            msgs.push({
              id: (msg.id as { toNumber: () => number }).toNumber(),
              sender: (msg.sender as PublicKey).toBase58(),
              arweaveHash: msg.arweaveHash,
              burnAfterReading: msg.burnAfterReading,
              burned: msg.burned,
              timestamp: new Date((msg.timestamp as { toNumber: () => number }).toNumber() * 1000),
            });
          } catch {
            // Skip failed fetches
          }
        }

        setMessages(msgs.reverse()); // Newest first
      } catch (err) {
        console.error("Failed to fetch inbox:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInbox();
  }, [anchorWallet, connection]);

  const handleUnlock = useCallback(async () => {
    if (!wallet.signMessage) return;
    setError(null);

    try {
      const messageBytes = new TextEncoder().encode(VOID_BURN_SIGN_MESSAGE);
      const signature = await wallet.signMessage(messageBytes);
      const { privateKeyJwk } = await deriveEncryptionKeyPair(signature);
      setPrivateKey(privateKeyJwk);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) {
        setError("Signature rejected. You must sign to decrypt messages.");
      } else {
        setError(`Failed to unlock: ${msg}`);
      }
    }
  }, [wallet]);

  const handleDecrypt = useCallback(async (msg: MessageInfo) => {
    if (!privateKey || !anchorWallet) return;
    setDecrypting(msg.id);
    setError(null);

    try {
      let packed: Uint8Array;

      // Try Arweave first
      try {
        packed = await fetchFromArweave(msg.arweaveHash);
      } catch {
        // Fallback to localStorage
        const key = `void-burn-dm-${anchorWallet.publicKey.toBase58()}`;
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        const entry = stored.find((s: { arweaveHash: string }) => s.arweaveHash === msg.arweaveHash);

        if (!entry) {
          setError(
            `Encrypted data not found for message #${msg.id}. ` +
            `Hash: ${msg.arweaveHash.slice(0, 16)}...`
          );
          setDecrypting(null);
          return;
        }
        packed = new Uint8Array(entry.encryptedPayload);
      }

      const payload = unpackPayload(packed);
      const decryptedBytes = await decryptWithDerivedKey(payload, privateKey);
      const parsed = parseSubmissionPayload(decryptedBytes);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, decrypted: parsed } : m
        )
      );
    } catch (err) {
      console.error("Decryption failed:", err);
      setError("Decryption failed. The message may be corrupted or the key doesn't match.");
    } finally {
      setDecrypting(null);
    }
  }, [privateKey, anchorWallet]);

  const handleBurn = useCallback(async (msg: MessageInfo) => {
    if (!anchorWallet) return;
    setBurning(msg.id);
    setError(null);

    try {
      const program = getProgram(anchorWallet);
      const [msgPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("dm"),
          anchorWallet.publicKey.toBuffer(),
          Buffer.from(new Uint8Array(new BigInt64Array([BigInt(msg.id)]).buffer)),
        ],
        PROGRAM_ID,
      );

      await program.methods
        .burnMessage()
        .accounts({
          message: msgPDA,
          recipient: anchorWallet.publicKey,
        })
        .rpc();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, burned: true } : m
        )
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to burn: ${errMsg}`);
    } finally {
      setBurning(null);
    }
  }, [anchorWallet]);

  const handleDownloadFile = (file: { name: string; type: string; data: number[] }) => {
    const bytes = new Uint8Array(file.data);
    const blob = new Blob([bytes], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!anchorWallet) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="mb-4 text-2xl font-semibold">My Inbox</h1>
        <p className="mb-6 text-[#888888]">
          Connect your wallet to view your encrypted messages.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="animate-pulse text-void-accent">Loading your inbox...</div>
      </div>
    );
  }

  if (inboxActive === false) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/burn" className="mb-4 inline-block text-sm text-[#888888] hover:text-white">
          &larr; Back to Void Burn
        </Link>

        <div className="rounded-lg border border-void-warning/30 bg-void-warning/5 p-6 text-center">
          <div className="mb-2 text-xl text-void-warning">Inbox Not Activated</div>
          <p className="mb-4 text-sm text-[#888888]">
            You need to activate your inbox before you can receive messages.
          </p>
          <Link
            to="/burn"
            className="inline-block rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
          >
            Activate Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/burn" className="mb-4 inline-block text-sm text-[#888888] hover:text-white">
        &larr; Back to Void Burn
      </Link>

      <h1 className="mb-2 text-2xl font-semibold">My Inbox</h1>
      <p className="mb-6 text-[#888888]">
        {messages.length} message{messages.length !== 1 ? "s" : ""}
      </p>

      {/* Unlock prompt */}
      {!privateKey ? (
        <div className="mb-6 rounded-lg border border-void-warning/30 bg-void-warning/5 p-5">
          <p className="mb-3 text-sm text-void-warning">
            Sign to unlock your inbox and decrypt messages
          </p>
          <button
            onClick={handleUnlock}
            className="rounded-lg bg-void-warning px-4 py-2 text-sm font-medium text-black transition hover:bg-void-warning/90"
          >
            Sign & Unlock
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded border border-void-success/30 bg-void-success/5 p-3 text-sm text-void-success">
          Inbox unlocked. You can decrypt messages.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-void-error/30 bg-void-error/5 p-4 text-sm text-void-error">
          {error}
        </div>
      )}

      {/* Messages list */}
      {messages.length === 0 ? (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <p className="text-[#888888]">No messages yet.</p>
          <p className="mt-2 text-sm text-[#888888]/60">
            Share your wallet address with others so they can send you encrypted messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border p-5 ${
                msg.burned
                  ? "border-void-error/30 bg-void-error/5"
                  : "border-void-border"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    Message #{msg.id}
                  </span>
                  {msg.burned && (
                    <span className="rounded bg-void-error/20 px-2 py-0.5 text-xs text-void-error">
                      Burned
                    </span>
                  )}
                  {msg.burnAfterReading && !msg.burned && (
                    <span className="rounded bg-void-warning/20 px-2 py-0.5 text-xs text-void-warning">
                      Burn requested
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#888888]">
                  {msg.timestamp.toLocaleString()}
                </span>
              </div>

              {msg.decrypted ? (
                <div className="space-y-3">
                  {/* Decrypted message */}
                  {msg.decrypted.message && (
                    <div className="rounded border border-void-accent/20 bg-void-bg p-4">
                      <p className="whitespace-pre-wrap text-sm text-white">
                        {msg.decrypted.message}
                      </p>
                    </div>
                  )}

                  {/* Decrypted files */}
                  {msg.decrypted.files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-[#888888]">
                        {msg.decrypted.files.length} file{msg.decrypted.files.length !== 1 ? "s" : ""} attached
                      </p>
                      {msg.decrypted.files.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded border border-void-border bg-void-surface px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">{file.name}</p>
                            <p className="text-xs text-[#888888]">
                              {formatSize(file.data.length)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="ml-3 rounded border border-void-accent px-3 py-1 text-xs text-void-accent transition hover:bg-void-accent/10"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Burn button */}
                  {!msg.burned && (
                    <button
                      onClick={() => handleBurn(msg)}
                      disabled={burning === msg.id}
                      className="rounded border border-void-error px-3 py-1 text-xs text-void-error transition hover:bg-void-error/10 disabled:opacity-50"
                    >
                      {burning === msg.id ? "Burning..." : "Burn Message"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-[#888888]">
                      {msg.arweaveHash.slice(0, 16)}...
                    </span>
                    <p className="mt-1 font-mono text-xs text-[#888888]/40">
                      from: {msg.sender.slice(0, 8)}...{msg.sender.slice(-4)}
                    </p>
                  </div>
                  {privateKey && !msg.burned && (
                    <button
                      onClick={() => handleDecrypt(msg)}
                      disabled={decrypting === msg.id}
                      className="rounded border border-void-accent px-3 py-1 text-xs text-void-accent transition hover:bg-void-accent/10 disabled:opacity-50"
                    >
                      {decrypting === msg.id ? "Decrypting..." : "Decrypt"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
