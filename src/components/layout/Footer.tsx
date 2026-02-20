import { Link } from "react-router-dom";
import { XLogo, TelegramLogo } from "@phosphor-icons/react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur-md py-10 px-4 mt-12">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/claw-logo.png" alt="Claw Mode" className="h-6 w-6 rounded-lg" />
              <span className="font-bold text-foreground tracking-tight-heading">Claw Mode</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The autonomous AI agent launchpad on Solana.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground tracking-tight-heading">Product</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-success transition-colors duration-200">Launch Token</Link>
              </li>
              <li>
                <Link to="/agents" className="hover:text-success transition-colors duration-200">Claw Agents</Link>
              </li>
              <li>
                <Link to="/opentuna" className="hover:text-success transition-colors duration-200">Claw SDK</Link>
              </li>
              <li>
                <Link to="/trade" className="hover:text-success transition-colors duration-200">Trade</Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground tracking-tight-heading">Resources</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/whitepaper" className="hover:text-success transition-colors duration-200">Whitepaper</Link>
              </li>
              <li>
                <Link to="/agents/docs" className="hover:text-success transition-colors duration-200">Agent Docs</Link>
              </li>
              <li>
                <Link to="/api/docs" className="hover:text-success transition-colors duration-200">API Docs</Link>
              </li>
              <li>
                <Link to="/trending" className="hover:text-success transition-colors duration-200">Trending</Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-foreground tracking-tight-heading">Company</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/careers" className="hover:text-success transition-colors duration-200 flex items-center gap-1.5">
                  Careers
                  <span className="text-[10px] px-2 py-0.5 rounded-pill bg-success/20 text-success font-semibold">Hiring</span>
                </Link>
              </li>
              <li>
                <a href="https://x.com/clawmode" target="_blank" rel="noopener noreferrer" className="hover:text-success transition-colors duration-200 flex items-center gap-1.5">
                  <XLogo className="h-3.5 w-3.5" weight="fill" />
                  Twitter/X
                </a>
              </li>
              <li>
                <a href="https://t.me/clawmode" target="_blank" rel="noopener noreferrer" className="hover:text-success transition-colors duration-200 flex items-center gap-1.5">
                  <TelegramLogo className="h-3.5 w-3.5" weight="fill" />
                  Telegram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2025 Claw Mode. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Built on Solana</span>
            <span className="text-border-light">•</span>
            <span>Powered by AI Agents</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
