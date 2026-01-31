import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import {
  deriveEncryptionKeyPair,
  VOID_BURN_SIGN_MESSAGE,
} from "../utils/encryption.ts";

export function BurnPage() {
  const [activating, setActivating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  const anchorWallet = useAnchorWallet();
  const wallet = useWallet();
  const { connection } = useConnection();

  // Check if user already has an inbox
  const checkInbox = useCallback(async () => {
    if (!anchorWallet) return false;
    try {
      const [inboxPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("inbox"), anchorWallet.publicKey.toBuffer()],
        PROGRAM_ID,
      );
      const info = await connection.getAccountInfo(inboxPDA);
      return info !== null;
    } catch {
      return false;
    }
  }, [anchorWallet, connection]);

  const handleActivate = useCallback(async () => {
    if (!anchorWallet || !wallet.signMessage) return;
    setActivating(true);
    setError(null);

    try {
      // Check if already activated
      const exists = await checkInbox();
      if (exists) {
        setError("Your inbox is already activated!");
        setActivating(false);
        return;
      }

      // Step 1: Sign the fixed message to derive encryption key
      setStatus("Sign message to derive encryption key...");
      const messageBytes = new TextEncoder().encode(VOID_BURN_SIGN_MESSAGE);
      const signature = await wallet.signMessage(messageBytes);

      // Step 2: Derive ECDH keypair from signature
      setStatus("Deriving encryption keypair...");
      const { publicKey: encryptionPubKey } = await deriveEncryptionKeyPair(signature);

      // Step 3: Activate inbox on-chain
      setStatus("Activating inbox on-chain...");
      const program = getProgram(anchorWallet);

      const [inboxPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("inbox"), anchorWallet.publicKey.toBuffer()],
        PROGRAM_ID,
      );

      await program.methods
        .activateInbox(Array.from(encryptionPubKey) as number[] & { length: 65 })
        .accounts({
          inbox: inboxPDA,
          owner: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setActivated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected")) {
        setError("Signature rejected. You must sign to activate your inbox.");
      } else {
        setError(`Activation failed: ${msg}`);
      }
    } finally {
      setActivating(false);
      setStatus("");
    }
  }, [anchorWallet, wallet, checkInbox]);

  if (activated) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
          <div className="mb-2 text-2xl text-void-success">Inbox Activated</div>
          <p className="text-sm text-[#888888]">
            Your encrypted inbox is now live. Anyone can send you end-to-end encrypted messages.
          </p>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/burn/inbox"
            className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
          >
            Go to Inbox
          </Link>
          <Link
            to="/burn/send"
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Send a Message
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Void Burn</h1>
      <p className="mb-8 text-[#888888]">
        Wallet-to-wallet encrypted messaging. Send private messages that only the recipient can read.
      </p>

      <div className="mb-6 flex gap-3">
        <Link
          to="/burn/send"
          className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
        >
          Send Message
        </Link>
        <Link
          to="/burn/inbox"
          className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
        >
          My Inbox
        </Link>
      </div>

      {/* Activate inbox section */}
      <div className="rounded-lg border border-void-border p-6">
        <h2 className="mb-2 text-lg font-medium">Activate Your Inbox</h2>
        <p className="mb-4 text-sm text-[#888888]">
          Before others can message you, activate your inbox. This creates an on-chain encryption key
          derived from your wallet signature — no extra keys to manage.
        </p>

        {!anchorWallet ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-[#888888]">Connect your wallet to activate</p>
            <WalletMultiButton />
          </div>
        ) : (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="w-full rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
          >
            {activating ? (status || "Activating...") : "Activate Inbox"}
          </button>
        )}

        {error && (
          <div className="mt-4 rounded border border-void-error/30 bg-void-error/5 p-3 text-sm text-void-error">
            {error}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-20 border-t border-void-border pt-12">
        <p className="mb-6 font-mono text-xs tracking-widest text-[#888888] uppercase">
          // How it works
        </p>
        <div className="space-y-6 text-sm leading-relaxed text-white">
          <p>
            When you <span className="text-void-accent">activate your inbox</span>, you sign a fixed message
            with your wallet. That signature is hashed and used to derive an{" "}
            <span className="font-mono text-void-accent">ECDH encryption keypair</span>. The public key
            goes on-chain. Your private key is never stored — it's re-derived each time you sign.
          </p>
          <p>
            To <span className="text-void-accent">send a message</span>, you look up the recipient's
            public key from their inbox on-chain. Your browser encrypts the message with{" "}
            <span className="font-mono">ECDH + AES-256-GCM</span> before it ever leaves your device.
            The encrypted blob goes to Arweave. A reference hash goes on-chain.
          </p>
          <p>
            To <span className="text-void-accent">read messages</span>, you sign again to re-derive
            your private key. Then you decrypt each message locally. No server ever sees the plaintext.
            No one can read your messages except you.
          </p>
          <p>
            Messages can be <span className="text-void-accent">burned</span> after reading.
            This marks them as destroyed on-chain — the Arweave data remains, but the reference is
            flagged. A digital paper trail that you choose to end.
          </p>
        </div>
        <p className="mt-8 font-mono text-xs text-[#888888]">
          Privacy is the power to selectively reveal oneself to the world.
        </p>
        <p className="mt-2 font-mono text-xs text-[#666666]">
          — Eric Hughes, A Cypherpunk's Manifesto
        </p>
      </div>
    </div>
  );
}
