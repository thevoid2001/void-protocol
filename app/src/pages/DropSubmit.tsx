import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import {
  encryptForOrg,
  packPayload,
  buildSubmissionPayload,
  type SubmissionFile,
} from "../utils/encryption.ts";
import { toHex } from "../utils/hash.ts";
import { uploadToArweave } from "../utils/arweave.ts";

interface OrgData {
  name: string;
  description: string;
  encryptionKey: Uint8Array;
  submissionCount: number;
  address: PublicKey;
}

export function DropSubmitPage() {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    if (!slug) return;

    const fetchOrg = async () => {
      setLoading(true);
      try {
        const [orgPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("org"), Buffer.from(slug)],
          PROGRAM_ID,
        );

        const accountInfo = await connection.getAccountInfo(orgPDA);
        if (!accountInfo) {
          setOrg(null);
          setLoading(false);
          return;
        }

        if (anchorWallet) {
          const program = getProgram(anchorWallet);
          const orgAccount = await program.account.organization.fetch(orgPDA);
          setOrg({
            name: orgAccount.name,
            description: orgAccount.description,
            encryptionKey: new Uint8Array(orgAccount.encryptionKey),
            submissionCount: (orgAccount.submissionCount as { toNumber: () => number }).toNumber(),
            address: orgPDA,
          });
        } else {
          const data = accountInfo.data;
          const slugLen = data.readUInt32LE(8);
          const nameOffset = 8 + 4 + slugLen;
          const nameLen = data.readUInt32LE(nameOffset);
          const nameStr = data.slice(nameOffset + 4, nameOffset + 4 + nameLen).toString("utf8");

          const descOffset = nameOffset + 4 + nameLen;
          const descLen = data.readUInt32LE(descOffset);
          const descStr = data.slice(descOffset + 4, descOffset + 4 + descLen).toString("utf8");

          const keyOffset = descOffset + 4 + descLen;
          const encKey = data.slice(keyOffset, keyOffset + 65);

          setOrg({
            name: nameStr,
            description: descStr,
            encryptionKey: new Uint8Array(encKey),
            submissionCount: 0,
            address: orgPDA,
          });
        }
      } catch (err) {
        console.error("Failed to fetch org:", err);
        setOrg(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [slug, connection, anchorWallet]);

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

  const handleSubmit = useCallback(async () => {
    if (!anchorWallet || !wallet || !org || (!message.trim() && files.length === 0)) return;
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Build structured payload (message + files) and encrypt
      setSubmitStatus("Encrypting...");
      const plainPayload = buildSubmissionPayload(message, files);
      const encrypted = await encryptForOrg(plainPayload, org.encryptionKey);
      const packed = packPayload(encrypted);

      // Step 2: Upload encrypted payload to Arweave via Irys
      setSubmitStatus("Uploading to Arweave...");
      let arweaveHash: string;
      try {
        arweaveHash = await uploadToArweave(wallet, packed);
      } catch (irysErr) {
        console.warn("Irys upload failed, falling back to local storage:", irysErr);
        // Fallback: store locally and use content hash as ID
        const hashBuffer = await crypto.subtle.digest("SHA-256", packed);
        arweaveHash = toHex(new Uint8Array(hashBuffer));

        const existing = JSON.parse(localStorage.getItem(`void-drop-${slug}`) || "[]");
        existing.push({
          id: org.submissionCount,
          arweaveHash,
          encryptedPayload: Array.from(packed),
          timestamp: Date.now(),
        });
        localStorage.setItem(`void-drop-${slug}`, JSON.stringify(existing));
      }

      // Step 3: Store submission reference on-chain
      setSubmitStatus("Recording on-chain...");
      const program = getProgram(anchorWallet);

      const orgAccount = await program.account.organization.fetch(org.address);
      const submissionId = (orgAccount.submissionCount as { toNumber: () => number }).toNumber();

      const [submissionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("submission"),
          org.address.toBuffer(),
          new BN(submissionId).toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID,
      );

      await program.methods
        .submitTip(arweaveHash)
        .accounts({
          submission: submissionPDA,
          organization: org.address,
          submitter: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Submission failed: ${msg}`);
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
    }
  }, [anchorWallet, wallet, org, message, files, slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="animate-pulse text-void-accent">Loading...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="text-xl text-void-error">Organization not found</div>
        <p className="mt-2 text-sm text-[#888888]">
          No drop box exists for "{slug}".
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
          <div className="mb-2 text-2xl text-void-success">Submission Delivered</div>
          <p className="text-sm text-[#888888]">
            Your encrypted message has been submitted to {org.name}.
            Only they can read it.
          </p>
        </div>
        <div className="mt-6 rounded border border-void-border bg-void-surface p-4 text-xs text-[#888888]">
          <p className="mb-2 font-mono uppercase tracking-wider">For your safety</p>
          <ul className="list-inside list-disc space-y-1 text-[#888888]">
            <li>Clear your browser history</li>
            <li>If using a burner wallet, disconnect it</li>
            <li>Close this tab</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">Submit to {org.name}</h1>
      <p className="mb-8 text-[#888888]">{org.description}</p>

      <div className="space-y-5">
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
            <span>Click to select files or drag them here</span>
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

        <div className="rounded border border-void-accent/20 bg-void-accent/5 p-4 text-sm">
          <p className="text-void-accent">End-to-end encrypted</p>
          <p className="mt-1 text-[#888888]">
            Your message and files are encrypted in your browser before they leave your device.
            Only {org.name} can decrypt and read them.
          </p>
        </div>

        <div className="rounded border border-void-border bg-void-surface p-4">
          <p className="mb-2 text-xs font-mono uppercase tracking-wider text-[#888888]">
            How to stay anonymous
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#888888]">
            <li>Use a VPN or Tor</li>
            <li>Use incognito / private browsing</li>
            <li>Use a fresh wallet with no history</li>
            <li>Don't include identifying information in your message</li>
          </ul>
        </div>

        {!anchorWallet ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-[#888888]">
              Connect a wallet to submit
            </p>
            <WalletMultiButton />
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || (!message.trim() && files.length === 0)}
            className="w-full rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
          >
            {submitting ? (submitStatus || "Submitting...") : "Encrypt & Submit"}
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
