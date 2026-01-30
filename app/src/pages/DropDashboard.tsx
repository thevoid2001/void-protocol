import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import {
  decryptSubmission,
  unpackPayload,
  parseSubmissionPayload,
  type SubmissionPayloadPlain,
} from "../utils/encryption.ts";
import { fetchFromArweave } from "../utils/arweave.ts";

interface OrgInfo {
  slug: string;
  name: string;
  submissionCount: number;
  address: PublicKey;
}

interface SubmissionInfo {
  id: number;
  arweaveHash: string;
  submitter: string;
  timestamp: Date;
  decrypted?: SubmissionPayloadPlain;
}

export function DropDashboardPage() {
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [privateKey, setPrivateKey] = useState<JsonWebKey | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  // Fetch orgs where the connected wallet is admin
  useEffect(() => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    const fetchMyOrgs = async () => {
      setLoading(true);
      try {
        const program = getProgram(wallet);
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            { dataSize: 8 + (4 + 32) + (4 + 64) + (4 + 256) + 65 + 32 + 8 + 8 + 1 + 1 },
          ],
        });

        const myOrgs: OrgInfo[] = [];
        for (const account of accounts) {
          try {
            const org = await program.account.organization.fetch(account.pubkey);
            if ((org.admin as PublicKey).toBase58() === wallet.publicKey.toBase58()) {
              myOrgs.push({
                slug: org.slug,
                name: org.name,
                submissionCount: (org.submissionCount as { toNumber: () => number }).toNumber(),
                address: account.pubkey,
              });
            }
          } catch {
            // Skip
          }
        }
        setOrgs(myOrgs);
      } catch (err) {
        console.error("Failed to fetch orgs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyOrgs();
  }, [wallet, connection]);

  // Fetch submissions for selected org
  const fetchSubmissions = useCallback(async (org: OrgInfo) => {
    if (!wallet) return;
    setSelectedOrg(org);
    setSubmissions([]);

    try {
      const program = getProgram(wallet);
      const subs: SubmissionInfo[] = [];

      for (let i = 0; i < org.submissionCount; i++) {
        try {
          const [subPDA] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("submission"),
              org.address.toBuffer(),
              Buffer.from(new Uint8Array(new BigInt64Array([BigInt(i)]).buffer)),
            ],
            PROGRAM_ID,
          );

          const sub = await program.account.submission.fetch(subPDA);
          subs.push({
            id: (sub.id as { toNumber: () => number }).toNumber(),
            arweaveHash: sub.arweaveHash,
            submitter: (sub.submitter as PublicKey).toBase58(),
            timestamp: new Date((sub.timestamp as { toNumber: () => number }).toNumber() * 1000),
          });
        } catch {
          // Skip failed fetches
        }
      }

      setSubmissions(subs.reverse()); // Newest first
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    }
  }, [wallet]);

  const handleLoadKey = () => {
    try {
      const parsed = JSON.parse(keyInput.trim()) as JsonWebKey;
      if (!parsed.kty || !parsed.crv) {
        throw new Error("Invalid key format");
      }
      setPrivateKey(parsed);
      setError(null);
    } catch {
      setError("Invalid key. Make sure you're pasting the correct private key JSON.");
    }
  };

  const handleDecrypt = async (sub: SubmissionInfo) => {
    if (!privateKey || !selectedOrg) return;
    setDecrypting(sub.id);
    setError(null);

    try {
      let packed: Uint8Array;

      // Try fetching from Arweave first
      try {
        packed = await fetchFromArweave(sub.arweaveHash);
      } catch {
        // Fallback: try localStorage (for older submissions or failed Irys uploads)
        const stored = JSON.parse(localStorage.getItem(`void-drop-${selectedOrg.slug}`) || "[]");
        const entry = stored.find((s: { arweaveHash: string }) => s.arweaveHash === sub.arweaveHash);

        if (!entry) {
          setError(
            `Encrypted data not found for submission #${sub.id}. ` +
            `The Arweave hash is: ${sub.arweaveHash.slice(0, 16)}...`
          );
          setDecrypting(null);
          return;
        }
        packed = new Uint8Array(entry.encryptedPayload);
      }

      const payload = unpackPayload(packed);
      const decryptedBytes = await decryptSubmission(payload, privateKey);
      const parsed = parseSubmissionPayload(decryptedBytes);

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === sub.id ? { ...s, decrypted: parsed } : s
        )
      );
    } catch (err) {
      console.error("Decryption failed:", err);
      setError("Decryption failed. Make sure you're using the correct private key for this organization.");
    } finally {
      setDecrypting(null);
    }
  };

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

  if (!wallet) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Org Dashboard</h1>
        <p className="mb-6 text-[#888888]">
          Connect the wallet that created your organization to view submissions.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="animate-pulse text-void-accent">Loading your organizations...</div>
      </div>
    );
  }

  // Org list view
  if (!selectedOrg) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-semibold">Org Dashboard</h1>
        <p className="mb-8 text-[#888888]">
          Organizations where you are the admin.
        </p>

        {orgs.length === 0 ? (
          <div className="rounded-lg border border-void-border p-8 text-center">
            <p className="text-[#888888]">
              No organizations found for this wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orgs.map((org) => (
              <button
                key={org.slug}
                onClick={() => fetchSubmissions(org)}
                className="w-full rounded-lg border border-void-border p-5 text-left transition hover:border-void-accent/30 hover:bg-void-accent/5"
              >
                <h2 className="text-lg font-medium text-white">{org.name}</h2>
                <p className="mt-1 text-sm text-[#888888]">
                  {org.submissionCount} submission{org.submissionCount !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Submissions view
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <button
        onClick={() => { setSelectedOrg(null); setPrivateKey(null); setKeyInput(""); setError(null); }}
        className="mb-4 text-sm text-[#888888] hover:text-white"
      >
        &larr; Back to organizations
      </button>

      <h1 className="mb-2 text-2xl font-semibold">{selectedOrg.name}</h1>
      <p className="mb-6 text-[#888888]">
        {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
      </p>

      {/* Private key loader */}
      {!privateKey ? (
        <div className="mb-6 rounded-lg border border-void-warning/30 bg-void-warning/5 p-5">
          <p className="mb-3 text-sm text-void-warning">
            Paste your private key to decrypt submissions
          </p>
          <textarea
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder='Paste your private key JSON here...'
            rows={3}
            className="w-full rounded-lg border border-void-border bg-void-bg px-4 py-3 font-mono text-xs text-white placeholder-[#888888]/40 outline-none transition focus:border-void-warning"
          />
          <button
            onClick={handleLoadKey}
            disabled={!keyInput.trim()}
            className="mt-3 rounded-lg bg-void-warning px-4 py-2 text-sm font-medium text-black transition hover:bg-void-warning/90 disabled:opacity-50"
          >
            Load Key
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded border border-void-success/30 bg-void-success/5 p-3 text-sm text-void-success">
          Private key loaded. You can decrypt submissions.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-void-error/30 bg-void-error/5 p-4 text-sm text-void-error">
          {error}
        </div>
      )}

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <p className="text-[#888888]">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-lg border border-void-border p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  Submission #{sub.id}
                </span>
                <span className="text-xs text-[#888888]">
                  {sub.timestamp.toLocaleString()}
                </span>
              </div>

              {sub.decrypted ? (
                <div className="space-y-3">
                  {/* Decrypted message */}
                  {sub.decrypted.message && (
                    <div className="rounded border border-void-accent/20 bg-void-bg p-4">
                      <p className="whitespace-pre-wrap text-sm text-white">
                        {sub.decrypted.message}
                      </p>
                    </div>
                  )}

                  {/* Decrypted file attachments */}
                  {sub.decrypted.files.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-[#888888]">
                        {sub.decrypted.files.length} file{sub.decrypted.files.length !== 1 ? "s" : ""} attached
                      </p>
                      {sub.decrypted.files.map((file, i) => (
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
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#888888]">
                    {sub.arweaveHash.slice(0, 16)}...
                  </span>
                  {privateKey && (
                    <button
                      onClick={() => handleDecrypt(sub)}
                      disabled={decrypting === sub.id}
                      className="rounded border border-void-accent px-3 py-1 text-xs text-void-accent transition hover:bg-void-accent/10 disabled:opacity-50"
                    >
                      {decrypting === sub.id ? "Decrypting..." : "Decrypt"}
                    </button>
                  )}
                </div>
              )}

              <p className="mt-2 font-mono text-xs text-[#888888]/40">
                from: {sub.submitter.slice(0, 8)}...{sub.submitter.slice(-4)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
