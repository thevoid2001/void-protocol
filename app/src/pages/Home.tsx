import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";

export function HomePage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <Logo size={80} />
      <h1 className="mt-6 text-3xl font-semibold">
        <span className="text-white">VOID</span>{" "}
        <span className="text-[#888888]">PROTOCOL</span>
      </h1>
      <p className="mt-3 text-[#888888]">
        Privacy tools for the sovereign individual.
      </p>

      <div className="mt-12 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        <Link
          to="/stamp"
          className="group rounded-lg border border-void-border p-6 transition hover:border-void-accent/30 hover:bg-void-accent/5"
        >
          <h2 className="mb-1 text-lg font-medium text-white group-hover:text-void-accent">
            Void Stamp
          </h2>
          <p className="text-sm text-[#888888]">
            Prove a file existed at a specific time without revealing it.
          </p>
        </Link>

        <Link
          to="/drop"
          className="group rounded-lg border border-void-border p-6 transition hover:border-void-accent/30 hover:bg-void-accent/5"
        >
          <h2 className="mb-1 text-lg font-medium text-white group-hover:text-void-accent">
            Void Drop
          </h2>
          <p className="text-sm text-[#888888]">
            Submit encrypted documents to organizations anonymously.
          </p>
        </Link>

        <Link
          to="/burn"
          className="group rounded-lg border border-void-border p-6 transition hover:border-void-accent/30 hover:bg-void-accent/5"
        >
          <h2 className="mb-1 text-lg font-medium text-white group-hover:text-void-accent">
            Void Burn
          </h2>
          <p className="text-sm text-[#888888]">
            Wallet-to-wallet encrypted messaging with optional burn.
          </p>
        </Link>

        <Link
          to="/feed"
          className="group rounded-lg border border-void-border p-6 transition hover:border-void-accent/30 hover:bg-void-accent/5"
        >
          <h2 className="mb-1 text-lg font-medium text-white group-hover:text-void-accent">
            Void Feed
          </h2>
          <p className="text-sm text-[#888888]">
            Private RSS reader. No algorithms, no tracking.
          </p>
        </Link>

        <div className="rounded-lg border border-void-border/50 p-6 opacity-40">
          <h2 className="mb-1 text-lg font-medium text-white">Void Switch</h2>
          <p className="text-sm text-[#888888]">
            Dead man's switch. Coming soon.
          </p>
        </div>
      </div>

      <p className="mt-16 text-xs text-[#888888]/50">
        No accounts. No tracking. Your data, your sovereignty.
      </p>
    </div>
  );
}
