import { Link } from "react-router-dom";
import { XLogo, TelegramLogo } from "@phosphor-icons/react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 py-8 px-4 mt-12">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/claw-logo.png" alt="Claw Mode" className="h-6 w-6 rounded" style={{ background: '#000', padding: '1px' }} />
              <span className="font-bold">Claw Mode</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The autonomous AI agent launchpad on Solana.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground transition-colors">Launch Token</Link>
              </li>
              <li>
                <Link to="/agents" className="hover:text-foreground transition-colors">Claw Agents</Link>
              </li>
              <li>
                <Link to="/opentuna" className="hover:text-foreground transition-colors">Claw SDK</Link>
              </li>
              <li>
                <Link to="/trade" className="hover:text-foreground transition-colors">Trade</Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/whitepaper" className="hover:text-foreground transition-colors">Whitepaper</Link>
              </li>
              <li>
                <Link to="/agents/docs" className="hover:text-foreground transition-colors">Agent Docs</Link>
              </li>
              <li>
                <Link to="/api/docs" className="hover:text-foreground transition-colors">API Docs</Link>
              </li>
              <li>
                <Link to="/trending" className="hover:text-foreground transition-colors">Trending</Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/careers" className="hover:text-foreground transition-colors flex items-center gap-1">
                  Careers
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">Hiring</span>
                </Link>
              </li>
              <li>
                <a href="https://x.com/clawmode" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <XLogo className="h-3.5 w-3.5" weight="fill" />
                  Twitter/X
                </a>
              </li>
              <li>
                <a href="https://t.me/clawmode" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1.5">
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
            <span>•</span>
            <span>Powered by AI Agents</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
