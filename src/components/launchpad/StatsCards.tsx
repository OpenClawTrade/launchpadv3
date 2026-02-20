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
      color: "text-accent-purple",
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
      color: "text-warning",
    },
    {
      label: "Agent Payouts",
      value: `${formatSOL(totalAgentPayouts)} SOL`,
      sub: formatUSD(totalAgentPayouts),
      icon: Send,
      color: "text-accent-cyan",
    },
  ];

  return (
    <div className="w-full flex items-center border-y border-border bg-surface/50 backdrop-blur-sm overflow-x-auto">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex items-center gap-2.5 px-5 py-2.5 flex-shrink-0 ${i < stats.length - 1 ? "border-r border-border" : ""}`}
        >
          <stat.icon className={`h-3.5 w-3.5 flex-shrink-0 ${stat.color}`} />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
              {stat.label}
            </span>
            <span className="text-[13px] font-semibold font-mono text-foreground leading-none">
              {stat.value}
            </span>
            {stat.sub && (
              <span className="text-[9px] font-mono text-muted-foreground/60 leading-none mt-0.5">
                {stat.sub}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
