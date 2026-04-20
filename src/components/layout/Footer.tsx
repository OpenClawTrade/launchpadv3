import { Link } from "react-router-dom";
import popshibaLogo from "@/assets/popshiba-logo.png";

export function Footer() {
  return (
    <footer className="bg-pop-ink text-pop-cream border-t-[3px] border-pop-orange">
      <div className="max-w-[1440px] mx-auto px-7 pt-[60px] pb-[30px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <span className="relative w-[38px] h-[38px] inline-block flex-shrink-0">
                <span className="absolute inset-0 border border-pop-orange rounded-sm bg-[#f5e6c8] -rotate-6" />
                <span className="absolute inset-0 border border-pop-orange rounded-sm bg-white rotate-3" />
                <img src={popshibaLogo} alt="" className="relative z-10 w-[86%] h-[86%] m-[7%] object-contain rotate-3" />
              </span>
              <span className="font-pop-display text-lg uppercase text-pop-orange tracking-tight">POPSHIBA</span>
            </div>
            <p className="text-pop-cream/55 text-[13px] leading-snug max-w-[360px] mb-4">
              The loudest barking launchpad on Ethereum. Fair-launched, community-run, fully on-chain.
            </p>
            <span className="inline-block bg-pop-orange text-pop-ink font-pop-mono text-[10px] tracking-[0.15em] font-bold px-2.5 py-1.5">
              v2.4 · ETH
            </span>
          </div>

          {/* Terminal */}
          <div>
            <h4 className="font-pop-display text-[13px] uppercase text-pop-orange mb-3.5 tracking-tight">Terminal</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link to="/trade" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Trade</Link></li>
              <li><Link to="/trade" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Pulse</Link></li>
              <li><Link to="/alpha-tracker" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Sniper</Link></li>
              <li><Link to="/alpha-tracker" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Copy trade</Link></li>
            </ul>
          </div>

          {/* Launchpad */}
          <div>
            <h4 className="font-pop-display text-[13px] uppercase text-pop-orange mb-3.5 tracking-tight">Launchpad</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link to="/launchpad" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Create token</Link></li>
              <li><Link to="/launchpad" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Bonding curve</Link></li>
              <li><Link to="/" className="text-pop-cream/55 hover:text-pop-orange transition-colors">King of the Hill</Link></li>
              <li><Link to="/tokens" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Migrations</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="font-pop-display text-[13px] uppercase text-pop-orange mb-3.5 tracking-tight">Community</h4>
            <ul className="space-y-2.5 text-[13px]">
              <li><a href="https://x.com/saturnterminal" target="_blank" rel="noopener noreferrer" className="text-pop-cream/55 hover:text-pop-orange transition-colors">X / Twitter</a></li>
              <li><a href="https://t.me" target="_blank" rel="noopener noreferrer" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Telegram</a></li>
              <li><Link to="/whitepaper" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Docs</Link></li>
              <li><Link to="/tokens" className="text-pop-cream/55 hover:text-pop-orange transition-colors">Contract</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto mt-10 pt-5 border-t border-dashed border-pop-orange/30 flex flex-wrap justify-between gap-3 font-pop-mono text-[11px] text-pop-cream/55">
          <span>© 2026 POPSHIBA · NOT FINANCIAL ADVICE · DYOR, DEGEN</span>
          <span>BUILT WITH BARK ON ETHEREUM</span>
        </div>
      </div>
    </footer>
  );
}
