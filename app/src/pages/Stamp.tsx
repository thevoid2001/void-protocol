import { useState, useCallback, useEffect } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { FileDropzone } from "../components/FileDropzone.tsx";
import { hashFile, toHex, formatFileSize } from "../utils/hash.ts";
import { getProgram, getProofPDA, PROGRAM_ID } from "../utils/program.ts";
import { generateCertificate } from "../utils/certificate.ts";

type Tab = "create" | "verify";

interface FileInfo {
  file: File;
  hash: Uint8Array;
  hashHex: string;
}

interface ProofResult {
  found: boolean;
  owner?: string;
  timestamp?: Date;
  transactionSignature?: string;
}

export function StampPage() {
  const [tab, setTab] = useState<Tab>("create");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [hashing, setHashing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const { connected, publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then((b) => setBalance(b / LAMPORTS_PER_SOL));
    }
  }, [publicKey, connection]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setProofResult(null);
    setTxSignature(null);
    setHashing(true);
    try {
      const hash = await hashFile(file);
      setFileInfo({ file, hash, hashHex: toHex(hash) });
    } catch {
      setError("Failed to hash file. Try again.");
    } finally {
      setHashing(false);
    }
  }, []);

  const handleCreateProof = useCallback(async () => {
    if (!wallet || !fileInfo) return;
    setCreating(true);
    setError(null);
    try {
      const program = getProgram(wallet);
      const proofPDA = getProofPDA(fileInfo.hash);

      const tx = await program.methods
        .createProof([...fileInfo.hash])
        .accounts({
          proof: proofPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSignature(tx);
      setProofResult({
        found: true,
        owner: wallet.publicKey.toBase58(),
        timestamp: new Date(),
        transactionSignature: tx,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already in use")) {
        setError("This file hash already exists on-chain. It was previously registered.");
      } else {
        setError(`Transaction failed: ${msg}`);
      }
    } finally {
      setCreating(false);
    }
  }, [wallet, fileInfo]);

  const handleVerify = useCallback(async (file: File) => {
    setError(null);
    setProofResult(null);
    setHashing(true);
    try {
      const hash = await hashFile(file);
      const hexHash = toHex(hash);
      setFileInfo({ file, hash, hashHex: hexHash });

      console.log("=== VERIFY DEBUG ===");
      console.log("File:", file.name, file.size, "bytes");
      console.log("Hash (hex):", hexHash);
      console.log("Hash (bytes):", [...hash]);

      const proofPDA = getProofPDA(hash);
      console.log("PDA address:", proofPDA.toBase58());
      console.log("Program ID:", PROGRAM_ID.toBase58());
      console.log("Connection endpoint:", connection.rpcEndpoint);

      try {
        const accountInfo = await connection.getAccountInfo(proofPDA);
        console.log("Account info:", accountInfo);

        if (!accountInfo || !accountInfo.data) {
          console.log("Account NOT found on-chain");
          setProofResult({ found: false });
          return;
        }

        console.log("Account FOUND, data length:", accountInfo.data.length);
        const data = accountInfo.data;
        const ownerBytes = data.slice(8 + 32, 8 + 32 + 32);
        const ownerPubkey = new PublicKey(ownerBytes);
        const timestampBytes = data.slice(8 + 32 + 32, 8 + 32 + 32 + 8);
        const view = new DataView(timestampBytes.buffer, timestampBytes.byteOffset, 8);
        const timestamp = Number(view.getBigInt64(0, true));

        setProofResult({
          found: true,
          owner: ownerPubkey.toBase58(),
          timestamp: new Date(timestamp * 1000),
        });
      } catch (fetchErr) {
        console.error("Verify fetch error:", fetchErr);
        setProofResult({ found: false });
      }
    } catch (err) {
      console.error("Verify hash error:", err);
      setError("Failed to hash or verify file.");
    } finally {
      setHashing(false);
    }
  }, [connection]);

  const handleDownloadCertificate = useCallback(() => {
    if (!fileInfo || !proofResult || !proofResult.found) return;
    generateCertificate({
      hash: fileInfo.hashHex,
      timestamp: proofResult.timestamp!,
      owner: proofResult.owner!,
      transactionSignature: proofResult.transactionSignature || txSignature || "N/A",
    });
  }, [fileInfo, proofResult, txSignature]);

  const reset = () => {
    setFileInfo(null);
    setProofResult(null);
    setError(null);
    setTxSignature(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Void Stamp</h1>
      <p className="mb-8 text-[#888888]">
        Prove a file existed at a specific time without revealing its contents.
      </p>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 rounded-lg border border-void-border p-1">
        <button
          onClick={() => { setTab("create"); reset(); }}
          className={`flex-1 rounded-md py-2 text-sm transition ${
            tab === "create"
              ? "bg-void-surface text-white"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Create Proof
        </button>
        <button
          onClick={() => { setTab("verify"); reset(); }}
          className={`flex-1 rounded-md py-2 text-sm transition ${
            tab === "verify"
              ? "bg-void-surface text-white"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Verify
        </button>
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <>
          {!proofResult && (
            <>
              {!fileInfo && !hashing && (
                <FileDropzone onFile={handleFile} />
              )}

              {hashing && (
                <div className="rounded-lg border border-void-border p-8 text-center">
                  <div className="mb-3 animate-pulse text-void-accent">Hashing file...</div>
                  <p className="text-sm text-[#888888]">
                    Computing SHA-256 hash locally
                  </p>
                </div>
              )}

              {fileInfo && !hashing && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-void-border p-6">
                    <div className="mb-4 space-y-3">
                      <div>
                        <span className="text-xs text-[#888888]">FILE</span>
                        <p className="text-white">{fileInfo.file.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[#888888]">SIZE</span>
                        <p className="text-white">{formatFileSize(fileInfo.file.size)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[#888888]">SHA-256</span>
                        <p className="break-all font-mono text-sm text-void-accent">
                          {fileInfo.hashHex}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-void-border bg-void-bg p-3 text-xs text-[#888888]">
                      <span>This file never leaves your device. Only the hash is stored on-chain.</span>
                    </div>
                  </div>

                  {!connected ? (
                    <div className="text-center">
                      <p className="mb-3 text-sm text-[#888888]">
                        Connect your wallet to create a proof
                      </p>
                      <WalletMultiButton />
                    </div>
                  ) : (
                    <>
                      {balance !== null && (
                        <p className="text-center text-xs text-[#888888]">
                          Wallet balance: {balance.toFixed(4)} SOL (devnet)
                        </p>
                      )}
                      <button
                        onClick={handleCreateProof}
                        disabled={creating}
                        className="w-full rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
                      >
                        {creating ? "Creating Proof..." : "Create Proof"}
                      </button>
                    </>
                  )}

                  <button
                    onClick={reset}
                    className="w-full py-2 text-sm text-[#888888] hover:text-white"
                  >
                    Choose a different file
                  </button>
                </div>
              )}
            </>
          )}

          {/* Success state */}
          {proofResult?.found && txSignature && (
            <div className="space-y-6">
              <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
                <div className="mb-2 text-2xl text-void-success">Proof Created</div>
                <p className="text-sm text-[#888888]">
                  Your file's existence has been permanently recorded on the Solana blockchain.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-void-border p-6">
                <div>
                  <span className="text-xs text-[#888888]">SHA-256 HASH</span>
                  <p className="break-all font-mono text-sm text-void-accent">
                    {fileInfo?.hashHex}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#888888]">TIMESTAMP</span>
                  <p className="text-white">
                    {proofResult.timestamp?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#888888]">TRANSACTION</span>
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all font-mono text-sm text-void-accent hover:underline"
                  >
                    {txSignature}
                  </a>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadCertificate}
                  className="flex-1 rounded-lg border border-void-accent py-3 text-sm text-void-accent transition hover:bg-void-accent/10"
                >
                  Download Certificate
                </button>
                <button
                  onClick={reset}
                  className="flex-1 rounded-lg border border-void-border py-3 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Verify Tab */}
      {tab === "verify" && (
        <>
          {!proofResult && !hashing && (
            <FileDropzone
              onFile={handleVerify}
              label="Drop a file to verify its proof"
            />
          )}

          {hashing && (
            <div className="rounded-lg border border-void-border p-8 text-center">
              <div className="mb-3 animate-pulse text-void-accent">Verifying...</div>
              <p className="text-sm text-[#888888]">
                Hashing file and checking on-chain
              </p>
            </div>
          )}

          {proofResult?.found && (
            <div className="space-y-6">
              <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
                <div className="mb-2 text-2xl text-void-success">Verified</div>
                <p className="text-sm text-[#888888]">
                  This file was proven to exist on the Solana blockchain.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-void-border p-6">
                <div>
                  <span className="text-xs text-[#888888]">SHA-256 HASH</span>
                  <p className="break-all font-mono text-sm text-void-accent">
                    {fileInfo?.hashHex}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#888888]">PROVEN TO EXIST SINCE</span>
                  <p className="text-white">
                    {proofResult.timestamp?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#888888]">REGISTERED BY</span>
                  <p className="break-all font-mono text-sm text-white">
                    {proofResult.owner}
                  </p>
                </div>
              </div>

              <button
                onClick={reset}
                className="w-full rounded-lg border border-void-border py-3 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
              >
                Verify Another File
              </button>
            </div>
          )}

          {proofResult && !proofResult.found && (
            <div className="space-y-6">
              <div className="rounded-lg border border-void-error/30 bg-void-error/5 p-6 text-center">
                <div className="mb-2 text-2xl text-void-error">No Proof Found</div>
                <p className="text-sm text-[#888888]">
                  This file has not been registered on Void Protocol.
                </p>
              </div>

              {fileInfo && (
                <div className="rounded-lg border border-void-border p-6">
                  <span className="text-xs text-[#888888]">SHA-256 HASH</span>
                  <p className="break-all font-mono text-sm text-[#888888]">
                    {fileInfo.hashHex}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setTab("create"); setProofResult(null); }}
                  className="flex-1 rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90"
                >
                  Create Proof
                </button>
                <button
                  onClick={reset}
                  className="flex-1 rounded-lg border border-void-border py-3 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
                >
                  Try Another File
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-6 rounded-lg border border-void-error/30 bg-void-error/5 p-4 text-center text-sm text-void-error">
          {error}
        </div>
      )}

      {/* How it works — cypherpunk explainer */}
      <div className="mt-20 border-t border-void-border pt-12">
        <p className="mb-6 font-mono text-xs tracking-widest text-[#888888] uppercase">
          // How it works
        </p>
        <div className="space-y-6 text-sm leading-relaxed text-white">
          <p>
            Your file <span className="text-void-accent">never leaves your machine</span>.
            When you drop a file, your browser computes a{" "}
            <span className="font-mono">SHA-256</span> hash — a unique
            cryptographic fingerprint — entirely on your device. Only that
            fingerprint touches the blockchain. The file itself goes nowhere.
          </p>
          <p>
            <span className="text-void-accent">SHA-256 is a one-way function.</span>{" "}
            You cannot reverse a hash back into the original file. Nobody
            looking at the chain can figure out what your file contains.
            All they see is a 64-character string of entropy.
          </p>
          <p>
            To verify, you provide the original file to whoever you choose —
            a judge, a journalist, a counterparty. They drop it in, the hash
            is recomputed locally on their machine, and the chain confirms:
            {" "}<span className="font-mono text-void-accent">yes, this exact file existed before this timestamp.</span>
          </p>
          <p>
            You decide who sees the file. You decide when.
            The blockchain only knows it existed.
          </p>
        </div>
        <p className="mt-8 font-mono text-xs text-[#888888]">
          Privacy is not secrecy. A private matter is something one doesn't
          want the whole world to know, but a secret matter is something one
          doesn't want anybody to know. Privacy is the power to selectively
          reveal oneself to the world.
        </p>
        <p className="mt-2 font-mono text-xs text-[#666666]">
          — Eric Hughes, A Cypherpunk's Manifesto, 1993
        </p>
      </div>
    </div>
  );
}
