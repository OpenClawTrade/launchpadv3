import { ReactNode } from "react";
import { PopshibaTopNav } from "@/components/layout/PopshibaTopNav";
import { PopshibaFooter } from "@/components/layout/PopshibaFooter";
import { DelegationPrompt } from "@/components/DelegationPrompt";

import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useLiveTradeToasts } from "@/hooks/useLiveTradeToasts";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
  hideFooter?: boolean;
  noPadding?: boolean;
  hideTicker?: boolean;
}

export function LaunchpadLayout({ children, hideFooter, noPadding }: LaunchpadLayoutProps) {
  useAnnouncements();
  useLiveTradeToasts();

  return (
    <div className="min-h-screen overflow-x-hidden flex flex-col" style={{ background: "#f5a524" }}>
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
      <DelegationPrompt />
    </div>
  );
}
