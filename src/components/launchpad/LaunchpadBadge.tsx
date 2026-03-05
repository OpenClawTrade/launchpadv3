import { cn } from "@/lib/utils";
import { Rocket, Briefcase, Zap } from "lucide-react";
import pumpfunPill from "@/assets/pumpfun-pill.webp";

interface LaunchpadBadgeProps {
  launchpadName?: string | null;
  launchpadType?: string | null;
  iconUrl?: string | null;
  className?: string;
}

const LAUNCHPAD_CONFIG: Record<string, { label: string; colors: string; fallbackIcon?: "rocket" | "briefcase" | "zap" }> = {
  "Pump.fun": { label: "pump", colors: "bg-primary/20 text-primary" },
  "Bonk": { label: "bonk", colors: "bg-orange-500/20 text-orange-400" },
  "Moonshot": { label: "moon", colors: "bg-purple-500/20 text-purple-400", fallbackIcon: "rocket" },
  "Believe": { label: "believe", colors: "bg-cyan-500/20 text-cyan-400", fallbackIcon: "zap" },
  "boop": { label: "boop", colors: "bg-pink-500/20 text-pink-400", fallbackIcon: "zap" },
  "Jupiter Studio": { label: "jup", colors: "bg-emerald-500/20 text-emerald-400", fallbackIcon: "zap" },
};

function resolveFromType(type?: string | null): string | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === "pump" || t === "pumpfun" || t === "pump.fun") return "Pump.fun";
  if (t === "dbc" || t === "meteora") return "Meteora";
  if (t === "bags") return "bags.fm";
  if (t === "bonk") return "Bonk";
  if (t === "moonshot") return "Moonshot";
  if (t === "believe") return "Believe";
  if (t === "boop") return "boop";
  return null;
}

const FallbackIcon = ({ type, className }: { type?: string; className?: string }) => {
  if (type === "rocket") return <Rocket className={className} />;
  if (type === "briefcase") return <Briefcase className={className} />;
  return <Zap className={className} />;
};

export function LaunchpadBadge({ launchpadName, launchpadType, iconUrl, className }: LaunchpadBadgeProps) {
  const resolved = launchpadName || resolveFromType(launchpadType);
  if (!resolved) return null;

  // bags.fm special case
  if (resolved === "bags.fm") {
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", "bg-blue-500/20 text-blue-400", className)}>
        <Briefcase className="h-2.5 w-2.5" />
        bags
      </span>
    );
  }

  // Meteora special case
  if (resolved === "Meteora") {
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", "bg-blue-500/20 text-blue-400", className)}>
        🐟
        <span>meteora</span>
      </span>
    );
  }

  const config = LAUNCHPAD_CONFIG[resolved];
  if (!config) {
    // Generic fallback with iconUrl or text
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground", className)}>
        {iconUrl ? <img src={iconUrl} alt="" className="h-2.5 w-2.5 rounded-full object-cover" /> : <Zap className="h-2.5 w-2.5" />}
        {resolved.slice(0, 6).toLowerCase()}
      </span>
    );
  }

  // Pump.fun uses the existing pill image
  if (resolved === "Pump.fun") {
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", config.colors, className)}>
        <img src={pumpfunPill} alt="" className="h-2.5 w-2.5 object-contain" />
        {config.label}
      </span>
    );
  }

  // Others: use iconUrl from Codex or fallback icon
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", config.colors, className)}>
      {iconUrl ? (
        <img src={iconUrl} alt="" className="h-2.5 w-2.5 rounded-full object-cover" />
      ) : (
        <FallbackIcon type={config.fallbackIcon} className="h-2.5 w-2.5" />
      )}
      {config.label}
    </span>
  );
}
