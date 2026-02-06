import { Card } from "@/components/ui/card";
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
      label: "Total Tokens",
      value: totalTokens.toString(),
      sub: "Launched",
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Total Agents",
      value: totalAgents.toString(),
      sub: "Active",
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
      sub: "In SubTuna",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="gate-stat-card">
          <div className="gate-stat-label">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="truncate">{stat.label}</span>
          </div>
          <div className="gate-stat-value">{stat.value}</div>
          {stat.sub && <div className="gate-stat-sub">{stat.sub}</div>}
        </Card>
      ))}
    </div>
  );
}
