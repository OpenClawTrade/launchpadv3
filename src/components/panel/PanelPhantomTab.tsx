import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { ExternalLink } from "lucide-react";

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
}

export default function PanelPhantomTab() {
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);

  return (
    <div className="space-y-4">
      {lastResult?.success && lastResult.mintAddress && (
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
          }}
        >
          {lastResult.imageUrl && (
            <img
              src={lastResult.imageUrl}
              alt={lastResult.name}
              className="w-10 h-10 rounded-xl object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-400">
              {lastResult.name} (${lastResult.ticker}) launched!
            </p>
            <p className="text-[11px] text-[#94A3B8] font-mono truncate">
              {lastResult.mintAddress}
            </p>
          </div>
          <div className="flex gap-2">
            {lastResult.solscanUrl && (
              <a
                href={lastResult.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#22D3EE] hover:underline flex items-center gap-1"
              >
                Solscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {lastResult.tradeUrl && (
              <a
                href={lastResult.tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#F97316] hover:underline flex items-center gap-1"
              >
                Trade <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      <TokenLauncher
        bare
        defaultMode="phantom"
        onLaunchSuccess={() => {
          toast({ title: "🚀 Token launched!", description: "Phantom launch completed successfully." });
        }}
        onShowResult={(result) => {
          setLastResult(result as LaunchResult);
        }}
      />
    </div>
  );
}
