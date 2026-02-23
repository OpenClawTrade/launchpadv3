import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { ExternalLink, CheckCircle2 } from "lucide-react";

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
    <div className="space-y-5 animate-in fade-in duration-500">
      {lastResult?.success && lastResult.mintAddress && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4 transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 100%)",
            border: "1px solid rgba(16,185,129,0.25)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 0 24px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {lastResult.imageUrl ? (
            <img
              src={lastResult.imageUrl}
              alt={lastResult.name}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-500/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-300 tracking-tight">
              {lastResult.name} (${lastResult.ticker}) launched!
            </p>
            <p className="text-[11px] text-[#64748B] font-mono truncate mt-0.5">
              {lastResult.mintAddress}
            </p>
          </div>
          <div className="flex gap-3">
            {lastResult.solscanUrl && (
              <a
                href={lastResult.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors duration-200"
              >
                Solscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {lastResult.tradeUrl && (
              <a
                href={lastResult.tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium hover:text-orange-300 flex items-center gap-1 transition-colors duration-200"
                style={{ color: "#fb923c" }}
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
