import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { getProgram, PROGRAM_ID } from "../utils/program.ts";
import { generateOrgKeyPair } from "../utils/encryption.ts";

export function DropCreatePage() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [step, setStep] = useState<"form" | "key" | "done">("form");
  const [privateKeyString, setPrivateKeyString] = useState("");

  const wallet = useAnchorWallet();
  const navigate = useNavigate();

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

  const handleCreate = useCallback(async () => {
    if (!wallet) return;
    setCreating(true);
    setError(null);

    try {
      const orgKeys = await generateOrgKeyPair();
      setPrivateKeyString(JSON.stringify(orgKeys.privateKeyJwk));

      const program = getProgram(wallet);
      const orgSlug = slugify(slug);

      const [orgPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("org"), Buffer.from(orgSlug)],
        PROGRAM_ID,
      );

      await program.methods
        .createOrganization(
          orgSlug,
          name,
          description,
          [...orgKeys.publicKey],
        )
        .accounts({
          organization: orgPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStep("key");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already in use")) {
        setError("This slug is already taken. Choose a different one.");
      } else {
        setError(`Failed to create organization: ${msg}`);
      }
    } finally {
      setCreating(false);
    }
  }, [wallet, slug, name, description]);

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(privateKeyString);
    setKeyCopied(true);
  };

  if (step === "key") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-void-warning/30 bg-void-warning/5 p-6">
          <h2 className="mb-3 text-xl font-semibold text-void-warning">
            Save Your Private Key
          </h2>
          <p className="mb-4 text-sm text-white leading-relaxed">
            This key is the <span className="text-void-warning">only way</span> to decrypt
            submissions to your organization. If you lose it, the encrypted messages are gone
            forever. We do not store this key anywhere.
          </p>

          <div className="relative rounded border border-void-border bg-void-bg p-4">
            <p className="break-all font-mono text-xs text-[#888888] select-all leading-relaxed">
              {privateKeyString}
            </p>
          </div>

          <button
            onClick={handleCopyKey}
            className="mt-4 w-full rounded-lg bg-void-warning py-3 text-sm font-medium text-black transition hover:bg-void-warning/90"
          >
            {keyCopied ? "Copied!" : "Copy Private Key"}
          </button>

          {keyCopied && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded border border-void-border p-3">
              <input
                type="checkbox"
                onChange={(e) => e.target.checked && setStep("done")}
                className="mt-0.5"
              />
              <span className="text-sm text-[#888888]">
                I have saved my private key somewhere safe. I understand it cannot be recovered.
              </span>
            </label>
          )}
        </div>
      </div>
    );
  }

  if (step === "done") {
    const orgSlug = slugify(slug);
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-void-success/30 bg-void-success/5 p-6 text-center">
          <div className="mb-2 text-2xl text-void-success">Drop Box Created</div>
          <p className="mb-4 text-sm text-[#888888]">
            Your organization is now accepting encrypted submissions.
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-lg border border-void-border p-6">
          <div>
            <span className="text-xs text-[#888888]">SUBMISSION URL</span>
            <Link
              to={`/drop/submit/${orgSlug}`}
              className="block font-mono text-sm text-void-accent hover:underline"
            >
              /drop/submit/{orgSlug}
            </Link>
          </div>
          <div>
            <span className="text-xs text-[#888888]">DASHBOARD</span>
            <Link
              to="/drop/dashboard"
              className="block font-mono text-sm text-void-accent hover:underline"
            >
              /drop/dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/drop/submit/${orgSlug}`)}
            className="flex-1 rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90"
          >
            View Submission Page
          </button>
          <button
            onClick={() => navigate("/drop/dashboard")}
            className="flex-1 rounded-lg border border-void-border py-3 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Create Drop Box</h1>
      <p className="mb-8 text-[#888888]">
        Set up an encrypted submission inbox for your organization.
      </p>

      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            Organization Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === slugify(name)) {
                setSlug(slugify(e.target.value));
              }
            }}
            placeholder="The Washington Post"
            maxLength={64}
            className="w-full rounded-lg border border-void-border bg-void-bg px-4 py-3 text-white placeholder-[#888888]/40 outline-none transition focus:border-void-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            URL Slug
          </label>
          <div className="flex items-center rounded-lg border border-void-border bg-void-bg">
            <span className="pl-4 text-sm text-[#888888]">/drop/submit/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="washington-post"
              maxLength={32}
              className="w-full bg-transparent px-1 py-3 text-white placeholder-[#888888]/40 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[#888888]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Submit tips to our investigative team. All submissions are end-to-end encrypted."
            maxLength={256}
            rows={3}
            className="w-full rounded-lg border border-void-border bg-void-bg px-4 py-3 text-white placeholder-[#888888]/40 outline-none transition focus:border-void-accent"
          />
          <p className="mt-1 text-right text-xs text-[#888888]/40">
            {description.length}/256
          </p>
        </div>

        <div className="rounded border border-void-border bg-void-surface p-4 text-sm text-[#888888]">
          When you create this drop box, an encryption keypair will be generated
          in your browser. The public key goes on-chain (anyone can encrypt to it).
          You must save the private key — it's the only way to read submissions.
        </div>

        {!wallet ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-[#888888]">
              Connect your wallet to create a drop box
            </p>
            <WalletMultiButton />
          </div>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating || !name || !slug}
            className="w-full rounded-lg bg-void-accent py-3 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Drop Box"}
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
