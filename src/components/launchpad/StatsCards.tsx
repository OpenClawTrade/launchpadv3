import { Card } from "@/components/ui/card";
import { Coins, Wallet, Repeat, BarChart3 } from "lucide-react";

interface StatsCardsProps {
  totalTokens: number;
  totalClaimed: number;
  totalPayouts: number;
  totalBuybacks: number;
  solPrice: number | null;
}

export function StatsCards({ totalTokens, totalClaimed, totalPayouts, totalBuybacks, solPrice }: StatsCardsProps) {
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

  const stats = [
    {
      label: "Total Tokens",
      value: totalTokens.toString(),
      sub: "Launched",
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Fees Claimed",
      value: `${formatSOL(totalClaimed)} SOL`,
      sub: formatUSD(totalClaimed),
      icon: Coins,
      color: "text-primary",
    },
    {
      label: "Creator Payouts",
      value: `${formatSOL(totalPayouts)} SOL`,
      sub: formatUSD(totalPayouts),
      icon: Wallet,
      color: "text-primary",
    },
    {
      label: "Buybacks",
      value: `${formatSOL(totalBuybacks)} SOL`,
      sub: formatUSD(totalBuybacks),
      icon: Repeat,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="gate-stat-card">
          <div className="gate-stat-label">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            {stat.label}
          </div>
          <div className="gate-stat-value">{stat.value}</div>
          {stat.sub && <div className="gate-stat-sub">{stat.sub}</div>}
        </Card>
      ))}
    </div>
  );
}
