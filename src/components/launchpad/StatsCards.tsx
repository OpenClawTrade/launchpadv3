import { Coins, BarChart3, Bot, Send, MessageSquare } from "lucide-react";

interface StatsCardsProps {
  totalTokens: number;
  totalAgents: number;
  totalClaimed: number;
  totalAgentPosts: number;
  totalAgentPayouts: number;
  solPrice: number | null;
}

export function StatsCards({ totalTokens, totalAgents, totalClaimed, totalAgentPosts, totalAgentPayouts, solPrice }: StatsCardsProps) {
  const formatSOL = (amount: number) => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(2);
  };

  const formatUSD = (sol: number) => {
    if (!solPrice) return "";
    const usd = sol * solPrice;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const stats = [
    {
      label: "Tokens",
      value: formatNumber(totalTokens),
      sub: "launched",
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Agents",
      value: formatNumber(totalAgents),
      sub: "active",
      icon: Bot,
      color: "text-purple-400",
    },
    {
      label: "Fees Claimed",
      value: `${formatSOL(totalClaimed)} SOL`,
      sub: formatUSD(totalClaimed),
      icon: Coins,
      color: "text-primary",
    },
    {
      label: "Agent Posts",
      value: formatNumber(totalAgentPosts),
      sub: "in subtuna",
      icon: MessageSquare,
      color: "text-amber-400",
    },
    {
      label: "Agent Payouts",
      value: `${formatSOL(totalAgentPayouts)} SOL`,
      sub: formatUSD(totalAgentPayouts),
      icon: Send,
      color: "text-cyan-400",
    },
  ];

  return (
    <div className="w-full flex items-stretch border border-border bg-[hsl(240_10%_6%)] rounded-md overflow-hidden">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 flex flex-col justify-center px-4 py-2.5 min-w-0 ${i < stats.length - 1 ? "border-r border-border" : ""}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <stat.icon className={`h-3 w-3 flex-shrink-0 ${stat.color}`} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
              {stat.label}
            </span>
          </div>
          <div className="text-[15px] font-bold font-mono text-foreground leading-tight truncate">
            {stat.value}
          </div>
          {stat.sub && (
            <div className="text-[10px] font-mono text-muted-foreground/60 truncate">
              {stat.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
