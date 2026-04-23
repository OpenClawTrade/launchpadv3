import { ReactNode } from "react";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { PopshibaFooter } from "@/components/layout/PopshibaFooter";
import { Footer } from "@/components/layout/Footer";
import { DelegationPrompt } from "@/components/DelegationPrompt";

import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useLiveTradeToasts } from "@/hooks/useLiveTradeToasts";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
  /** Hide the dark "© POPSHIBA" footer band. The sticky bottom bar is always shown. */
  hideFooter?: boolean;
  noPadding?: boolean;
  hideTicker?: boolean;
}

/**
 * Canonical app chrome — used by EVERY page so header + footer stay 1:1
 * with the landing page (`/`):
 *   PopshibaTopNav  →  <main>{children}</main>  →  PopshibaFooter  →  Footer (sticky bar)
 */
export function LaunchpadLayout({ children, hideFooter, noPadding }: LaunchpadLayoutProps) {
  useAnnouncements();
  useLiveTradeToasts();

  return (
    <div className="min-h-screen overflow-x-hidden flex flex-col bg-pop-orange font-pop-body text-pop-ink">
      <PopshibaTopNav />
      <main
        className={
          noPadding
            ? "flex-1 overflow-x-hidden relative z-10"
            : "flex-1 overflow-x-hidden relative z-10 px-4 pb-12 pt-4 md:p-4"
        }
      >
        {children}
      </main>
      {!hideFooter && <PopshibaFooter />}
      <Footer />
      <DelegationPrompt />
    </div>
  );
}
