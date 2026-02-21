import { useMemo } from "react";

interface DexscreenerChartProps {
  mintAddress: string;
  height?: number;
}

export function DexscreenerChart({ mintAddress, height = 400 }: DexscreenerChartProps) {
  const src = useMemo(
    () =>
      `https://dexscreener.com/solana/${mintAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15`,
    [mintAddress]
  );

  if (!mintAddress) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, backgroundColor: "#0F172A" }}
      >
        <p className="text-[11px] text-muted-foreground/60 font-mono">No token address</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height, backgroundColor: "#0F172A" }}>
      <iframe
        src={src}
        className="w-full h-full border-0"
        style={{ colorScheme: "dark" }}
        title="Token Chart"
        allow="clipboard-write"
        loading="lazy"
      />
      {/* Cover bottom-left branding area */}
      <div
        className="absolute bottom-0 left-0 pointer-events-none"
        style={{
          width: 180,
          height: 40,
          background: "linear-gradient(to right, #0b0f1a 70%, transparent)",
          zIndex: 10,
        }}
      />
      {/* Cover top-right branding if visible */}
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: 140,
          height: 32,
          background: "linear-gradient(to left, #0b0f1a 60%, transparent)",
          zIndex: 10,
        }}
      />
    </div>
  );
}
