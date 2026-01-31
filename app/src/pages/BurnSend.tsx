import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import {
  encryptForRecipient,
  packPayload,
  buildSubmissionPayload,
  type SubmissionFile,
} from "../utils/encryption.ts";
import { toHex } from "../utils/hash.ts";
import { uploadToArweave } from "../utils/arweave.ts";

export function BurnSendPage() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const { connection } = useConnection();

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: SubmissionFile[] = [];
    for (const file of Array.from(selected)) {
      const buffer = await file.arrayBuffer();
      newFiles.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: new Uint8Array(buffer),
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = useCallback(async () => {
    if (!anchorWallet || !wallet || (!message.trim() && files.length === 0)) return;
    setSending(true);
    setError(null);

    try {
      // Validate recipient address
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipientAddress.trim());
      } catch {
        setError("Invalid recipient wallet address");
        setSending(false);
        return;
      }

      // Look up recipient's inbox
      setStatus("Looking up recipient's inbox...");
      const [inboxPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("inbox"), recipientPubkey.toBuffer()],
        PROGRAM_ID,
      );

      const program = getProgram(anchorWallet);
      let inboxAccount;
      try {
        inboxAccount = await program.account.inbox.fetch(inboxPDA);
      } catch {
        setError("Recipient has not activated their inbox. They need to activate it on Void Burn first.");
        setSending(false);
        return;
      }

      const recipientEncryptionKey = new Uint8Array(inboxAccount.encryptionKey);
      const messageCount = (inboxAccount.messageCount as { toNumber: () => number }).toNumber();

      // Encrypt the message
      setStatus("Encrypting message...");
      const plainPayload = buildSubmissionPayload(message, files);
      const encrypted = await encryptForRecipient(plainPayload, recipientEncryptionKey);
      const packed = packPayload(encrypted);

      // Upload to Arweave
      setStatus("Uploading to Arweave...");
      let arweaveHash: string;
      try {
        arweaveHash = await uploadToArweave(wallet, packed);
      } catch (irysErr) {
        console.warn("Irys upload failed, using content hash:", irysErr);
        const hashBuffer = await crypto.subtle.digest("SHA-256", packed);
        arweaveHash = toHex(new Uint8Array(hashBuffer));

        // Store locally as fallback
        const key = `void-burn-dm-${recipientPubkey.toBase58()}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push({
          id: messageCount,
          arweaveHash,
          encryptedPayload: Array.from(packed),
          timestamp: Date.now(),
        });
        localStorage.setItem(key, JSON.stringify(existing));
      }

      // Store on-chain
      setStatus("Recording on-chain...");
      const [messagePDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("dm"),
          recipientPubkey.toBuffer(),
          Buffer.from(new Uint8Array(new BigInt64Array([BigInt(messageCount)]).buffer)),
        ],
        PROGRAM_ID,
      );

      await program.methods
        .sendDirectMessage(arweaveHash, burnAfterReading)
        .accounts({
          message: messagePDA,
          recipientInbox: inboxPDA,
          sender: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to send: ${msg}`);
    } finally {
      setSending(false);
      setStatus("");
    }
  }, [anchorWallet, wallet, recipientAddress, message, files, burnAfterReading]);

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
          <div className="mb-2 text-2xl text-void-success">Message Sent</div>
          <p className="text-sm text-[#888888]">
            Your encrypted message has been delivered. Only the recipient can decrypt it.
          </p>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => {
              setSent(false);
              setMessage("");
              setFiles([]);
              setRecipientAddress("");
            }}
            className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
          >
            Send Another
          </button>
          <Link
            to="/burn"
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Back to Burn
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

      <h1 className="mb-2 text-2xl font-semibold">Send Encrypted Message</h1>
      <p className="mb-8 text-[#888888]">
        Send a private message to any wallet with an activated inbox.
      </p>

      <div className="space-y-5">
        {/* Recipient address */}
        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            Recipient wallet address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="e.g. 7xKXt..."
            className="w-full rounded-lg border border-void-border bg-void-bg px-4 py-3 font-mono text-sm text-white placeholder-[#888888]/40 outline-none transition focus:border-void-accent"
          />
        </div>

        {/* Message */}
        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            Your message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message here..."
            rows={6}
            className="w-full rounded-lg border border-void-border bg-void-bg px-4 py-3 text-white placeholder-[#888888]/40 outline-none transition focus:border-void-accent"
          />
        </div>

        {/* File attachments */}
        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            Attach files
          </label>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-void-border bg-void-bg px-4 py-6 text-sm text-[#888888] transition hover:border-void-accent/50 hover:text-white">
            <span>Click to select files</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileAdd}
            />
          </label>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, i) => (
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
                    onClick={() => removeFile(i)}
                    className="ml-3 text-xs text-[#888888] hover:text-void-error"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Burn after reading toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBurnAfterReading(!burnAfterReading)}
            className={`relative h-6 w-11 rounded-full transition ${
              burnAfterReading ? "bg-void-warning" : "bg-void-border"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                burnAfterReading ? "left-6" : "left-1"
              }`}
            />
          </button>
          <span className="text-sm text-[#888888]">
            Suggest burn after reading
          </span>
        </div>
        <p className="text-xs text-[#888888]/60">
          If enabled, the recipient will see a prompt to burn (delete) the message after reading.
          They can still choose not to.
        </p>

        {/* Encryption notice */}
        <div className="rounded border border-void-accent/20 bg-void-accent/5 p-4 text-sm">
          <p className="text-void-accent">End-to-end encrypted</p>
          <p className="mt-1 text-[#888888]">
            Your message is encrypted in your browser before leaving your device.
            Only the recipient can decrypt and read it.
          </p>
        </div>

        {/* Submit */}
        {!anchorWallet ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-[#888888]">Connect wallet to send</p>
            <WalletMultiButton />
          </div>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending || (!message.trim() && files.length === 0) || !recipientAddress.trim()}
            className="w-full rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
          >
            {sending ? (status || "Sending...") : "Encrypt & Send"}
          </button>
        )}

        {error && (
          <div className="rounded-lg border border-void-error/30 bg-void-error/5 p-4 text-center text-sm text-void-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
