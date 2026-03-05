import { useState } from "react";
import { useCodexTokenEvents } from "@/hooks/useCodexTokenEvents";
import { useTokenHolders } from "@/hooks/useTokenHolders";
import { CodexTokenTrades } from "./CodexTokenTrades";
import { Loader2 } from "lucide-react";

interface Props {
  tokenAddress: string;
  holderCount?: number;
}

type TabKey = "trades" | "holders" | "top_traders";

export function TokenDataTabs({ tokenAddress, holderCount = 0 }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("trades");
  const { data, isLoading } = useCodexTokenEvents(tokenAddress);
  const { data: holdersData, isLoading: holdersLoading, dataUpdatedAt } = useTokenHolders(
    tokenAddress,
    activeTab === "holders"
  );

  const liveHolderCount = holdersData?.count ?? holderCount;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "trades", label: "Trades", count: data?.events?.length },
    { key: "holders", label: "Holders", count: liveHolderCount },
    { key: "top_traders", label: "Top Traders" },
  ];

  return (
    <div className="terminal-panel-flush rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-white/[0.06] px-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-[11px] font-mono transition-colors relative ${
              activeTab === tab.key
                ? "text-foreground font-bold"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-[9px] text-muted-foreground/50">({tab.count})</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "trades" && (
          <CodexTokenTrades events={data?.events || []} isLoading={isLoading} />
        )}
        {activeTab === "holders" && (
          <div className="flex items-center justify-center py-10">
            {holdersLoading && !holdersData ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-center space-y-2">
                <p className="text-2xl font-mono font-bold text-foreground">{liveHolderCount.toLocaleString()}</p>
                <p className="text-xs font-mono text-muted-foreground/60">Total Holders</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[9px] font-mono text-green-500/70">LIVE</span>
                  {dataUpdatedAt > 0 && (
                    <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">
                      {new Date(dataUpdatedAt).toLocaleTimeString()}
                    </span>
                  )}
                  {holdersLoading && (
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground/40 ml-1" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "top_traders" && (
          <div className="flex items-center justify-center py-10">
            <span className="text-xs font-mono text-muted-foreground/50">Coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
