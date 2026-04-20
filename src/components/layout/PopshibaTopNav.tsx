import { Link, useLocation } from "react-router-dom";
import popshibaLogo from "@/assets/popshiba-logo.png";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Pulse", to: "/launchpad" },
  { label: "Tokens", to: "/tokens" },
  { label: "Launchpad", to: "/launch" },
  { label: "Discover", to: "/discover" },
  { label: "Alpha", to: "/alpha-tracker" },
  { label: "X Tracker", to: "/x-tracker" },
  { label: "Docs", to: "/docs" },
];

/** Tilted brand frame: two stacked rotated squares with the logo on top. */
function BrandFrame() {
  return (
    <span className="relative inline-block w-[38px] h-[38px] flex-shrink-0">
      <span className="absolute inset-0 border border-pop-orange rounded-[2px] bg-[#f5e6c8] -rotate-[6deg] z-0" />
      <span className="absolute inset-0 border border-pop-orange rounded-[2px] bg-white rotate-[3deg] z-[1]" />
      <img
        src={popshibaLogo}
        alt="Popshiba"
        className="relative z-[2] w-[86%] h-[86%] m-[7%] object-contain rotate-[3deg]"
      />
    </span>
  );
}

export function PopshibaTopNav() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-[100] bg-pop-ink text-pop-cream border-b-[3px] border-pop-orange">
      <div className="max-w-[1440px] mx-auto flex items-center gap-6 px-7 py-3 flex-wrap">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 font-pop-display text-[18px] tracking-[-0.02em] text-pop-orange">
          <BrandFrame />
          POPSHIBA
        </Link>

        {/* Links */}
        <nav className="flex gap-5 text-[13px] font-bold flex-wrap">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.to || (link.to !== "/" && pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-0.5 py-1 transition-colors ${
                  active ? "text-pop-cream" : "text-pop-cream/85 hover:text-pop-cream"
                }`}
              >
                {link.label}
                <span
                  className={`absolute left-0 right-0 -bottom-0.5 h-[3px] bg-pop-orange transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2.5">
          <Link
            to="/trade"
            className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-cream text-pop-cream bg-transparent shadow-[3px_3px_0_hsl(var(--pop-orange))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-orange))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-orange))] transition-all"
          >
            Launch app
          </Link>
          <Link
            to="/launch"
            className="inline-flex items-center gap-2 font-bold text-[13px] px-4 py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all"
          >
            + Create
          </Link>
        </div>
      </div>
    </header>
  );
}
