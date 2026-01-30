import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";

interface OrgInfo {
  slug: string;
  name: string;
  description: string;
  active: boolean;
  submissionCount: number;
  address: string;
}

export function DropPage() {
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all Organization accounts from the program
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          // Organization accounts have a specific discriminator (first 8 bytes)
          // We'll filter by size range — org accounts are ~487 bytes
          { dataSize: 8 + (4 + 32) + (4 + 64) + (4 + 256) + 65 + 32 + 8 + 8 + 1 + 1 },
        ],
      });

      if (wallet) {
        const program = getProgram(wallet);
        const orgList: OrgInfo[] = [];
        for (const account of accounts) {
          try {
            const org = await program.account.organization.fetch(account.pubkey);
            if (org.active) {
              orgList.push({
                slug: org.slug,
                name: org.name,
                description: org.description,
                active: org.active,
                submissionCount: (org.submissionCount as { toNumber: () => number }).toNumber(),
                address: account.pubkey.toBase58(),
              });
            }
          } catch {
            // Skip accounts that don't deserialize as Organization
          }
        }
        setOrgs(orgList);
      } else {
        // Without wallet, just try to parse accounts manually
        // For now show empty state prompting wallet connection
        setOrgs([]);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Void Drop</h1>
      <p className="mb-8 text-[#888888]">
        Submit encrypted documents to organizations anonymously.
      </p>

      <div className="mb-6 flex gap-3">
        <Link
          to="/drop/create"
          className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
        >
          Create Drop Box
        </Link>
        <Link
          to="/drop/dashboard"
          className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
        >
          Org Dashboard
        </Link>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <div className="animate-pulse text-void-accent">Loading organizations...</div>
        </div>
      )}

      {!loading && orgs.length === 0 && (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <p className="text-[#888888]">
            No organizations found yet.
          </p>
          <p className="mt-2 text-sm text-[#888888]/60">
            {wallet
              ? "Be the first to create a drop box."
              : "Connect your wallet to see organizations or create one."}
          </p>
        </div>
      )}

      {!loading && orgs.length > 0 && (
        <div className="space-y-3">
          {orgs.map((org) => (
            <Link
              key={org.slug}
              to={`/drop/submit/${org.slug}`}
              className="group block rounded-lg border border-void-border p-5 transition hover:border-void-accent/30 hover:bg-void-accent/5"
            >
              <h2 className="text-lg font-medium text-white group-hover:text-void-accent">
                {org.name}
              </h2>
              <p className="mt-1 text-sm text-[#888888]">
                {org.description}
              </p>
              <p className="mt-2 text-xs text-[#888888]/50">
                {org.submissionCount} submission{org.submissionCount !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* How it works — cypherpunk explainer */}
      <div className="mt-20 border-t border-void-border pt-12">
        <p className="mb-6 font-mono text-xs tracking-widest text-[#888888] uppercase">
          // How it works
        </p>
        <div className="space-y-6 text-sm leading-relaxed text-white">
          <p>
            An organization creates a <span className="text-void-accent">drop box</span>.
            When they do, an encryption keypair is generated entirely in their browser —
            a <span className="font-mono">public key</span> and a{" "}
            <span className="font-mono">private key</span>. The public key goes on-chain.
            The private key never leaves the admin's hands.
          </p>
          <p>
            When you submit a message or file, your browser grabs the org's public key
            from the blockchain and uses{" "}
            <span className="font-mono text-void-accent">ECDH + AES-256-GCM</span>{" "}
            to encrypt everything <span className="text-void-accent">before it leaves your device</span>.
            Not even the network can see what you wrote. The encrypted blob is stored on{" "}
            <span className="font-mono">Arweave</span> — permanent, decentralized, immutable.
            A reference hash goes on-chain.
          </p>
          <p>
            Only the organization's private key can decrypt the submission.
            No server, no platform, no intermediary ever sees the plaintext.
            The submitter generates a throwaway keypair for each message —
            {" "}<span className="text-void-accent">used once, then destroyed</span>.
            There is no session, no account, no trail back to you.
          </p>
          <p>
            This is a <span className="text-void-accent">one-way drop</span>.
            You send it and disappear. The org reads it when they choose.
            No one else can. Not us, not the chain, not anyone watching the wire.
          </p>
        </div>
        <p className="mt-8 font-mono text-xs text-[#888888]">
          The question is not whether you have something to hide.
          The question is whether the powerful should have the right
          to know everything about you — while you know nothing about them.
        </p>
        <p className="mt-2 font-mono text-xs text-[#666666]">
          — Julian Assange
        </p>
      </div>
    </div>
  );
}
