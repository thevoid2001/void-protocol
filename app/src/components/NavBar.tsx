import { Link, useLocation } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Logo } from "./Logo.tsx";

export function NavBar() {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname.startsWith(path)
      ? "text-void-accent"
      : "text-[#888888] hover:text-white";

  return (
    <nav className="border-b border-void-border px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Logo size={32} />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-white">VOID</span>
            <span className="text-sm text-[#888888]">PROTOCOL</span>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/stamp" className={`text-sm transition ${isActive("/stamp")}`}>
            Stamp
          </Link>
          <Link to="/drop" className={`text-sm transition ${isActive("/drop")}`}>
            Drop
          </Link>
          <Link to="/burn" className={`text-sm transition ${isActive("/burn")}`}>
            Burn
          </Link>
          <Link to="/feed" className={`text-sm transition ${isActive("/feed")}`}>
            Feed
          </Link>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
