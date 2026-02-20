import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Gift, Handshake, Building2, Users, Zap, Shield, TrendingUp, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

const PIE_DATA = [
  { name: "Early Airdrop", value: 5, color: "#f59e0b" },
  { name: "Marketing & Collabs", value: 20, color: "#8b5cf6" },
  { name: "CEX & Market Making", value: 25, color: "#06b6d4" },
  { name: "Team (Vested)", value: 5, color: "#f97316" },
  { name: "Future Airdrops", value: 5, color: "#ec4899" },
  { name: "Platform Reserve", value: 10, color: "#4ade80" },
  { name: "Circulating / Public", value: 30, color: "#475569" },
];

const TOTAL_SUPPLY = "1,000,000,000";

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 shadow-xl">
        <p className="text-white font-semibold text-sm">{d.name}</p>
        <p className="font-mono text-lg" style={{ color: d.color }}>{d.value}%</p>
        <p className="text-white/40 text-xs">{(d.value * 10_000_000).toLocaleString()} tokens</p>
      </div>
    );
  }
  return null;
}

interface AllocCardProps {
  color: string;
  icon: React.ReactNode;
  title: string;
  percent: number;
  tokens: string;
  children: React.ReactNode;
}

function AllocCard({ color, icon, title, percent, tokens, children }: AllocCardProps) {
  return (
    <Card className="bg-[#111] p-6 md:p-8" style={{ borderColor: `${color}20` }}>
      <div className="flex flex-wrap items-start gap-4 mb-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl font-bold" style={{ color }}>{percent}%</span>
            <span className="text-white/30 text-sm font-mono">{tokens} CLAW</span>
          </div>
        </div>
      </div>
      <div>{children}</div>
    </Card>
  );
}

export default function TokenomicsPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="max-w-5xl mx-auto px-4 py-10 space-y-12 w-full">

          {/* Hero */}
          <div className="text-center space-y-3">
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 font-mono text-xs px-3 py-1">
              TOKENOMICS
            </Badge>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              ClawMode Token Distribution
            </h1>
            <p className="text-white/50 max-w-xl mx-auto text-sm leading-relaxed">
              A transparent, community-first token structure designed for long-term sustainability,
              exchange growth, and rewarding early adopters.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 font-mono text-white/60 text-sm">
              Total Supply: <span className="text-white font-bold ml-1">{TOTAL_SUPPLY}</span>&nbsp;CLAW
            </div>
          </div>

          {/* Pie Chart + Legend */}
          <Card className="bg-[#111] border-white/10 p-6 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="h-72 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={PIE_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {PIE_DATA.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {PIE_DATA.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-sm text-white/70">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold" style={{ color: item.color }}>{item.value}%</span>
                      <span className="text-white/30 text-xs font-mono hidden sm:block">
                        {(item.value * 10_000_000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Airdrop Banner */}
          <Card className="relative overflow-hidden border-yellow-500/30 bg-yellow-500/5 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-400/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Gift className="h-7 w-7 text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-white">Early Airdrop — 5% Supply</h2>
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Ends Feb 28, 2025
                  </Badge>
                </div>
                <p className="text-white/60 text-sm leading-relaxed mb-4">
                  50,000,000 CLAW tokens are reserved for early platform users who actively engage
                  with the ClawMode ecosystem before February 28th. This airdrop rewards genuine participation
                  — not bots, not whales — but real early believers who helped bootstrap the community
                  during our most critical growth phase. Every eligible action is tracked on-chain
                  and validated against Sybil-resistance heuristics.
                </p>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: Zap, label: "Launch coins on platform" },
                    { icon: TrendingUp, label: "Trade & use the website" },
                    { icon: Users, label: "Follow & retweet on X" },
                    { icon: Gift, label: "Like & max engage on X" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-2">
                      <Icon className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                      <span className="text-xs text-white/70">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Allocation Cards */}
          <div className="space-y-6">

            {/* Marketing 20% */}
            <AllocCard
              color="#8b5cf6"
              icon={<Handshake className="h-6 w-6 text-purple-400" />}
              title="Marketing & Strategic Collaborations"
              percent={20}
              tokens="200,000,000"
            >
              <p className="text-white/60 text-sm leading-relaxed">
                200M tokens are reserved exclusively for strategic marketing initiatives and
                high-value collaborations with protocols, influencers, and institutional partners.
                In the competitive landscape of DeFi and AI-agent launchpads, visibility is not
                optional — it is infrastructure.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                This allocation funds co-marketing campaigns with top-tier Solana ecosystem projects,
                liquidity incentive programs, sponsored content across major crypto media channels
                (CoinGecko, CoinMarketCap, Decrypt, The Block), paid partnerships with KOLs, and
                protocol-level integrations that drive organic adoption. Marketing spend is governed
                by measurable KPIs: new wallets, token volume, and agent registrations — ensuring
                capital is deployed only where ROI is quantifiable.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                A token with no distribution strategy, no matter how technically sound, fails to
                attract liquidity, users, or developer mindshare. Network effects in DeFi are
                winner-take-most: the first mover with sufficient visibility captures the majority
                of liquidity, integrations, and brand recognition. This allocation is the mechanism
                by which ClawMode transitions from a product to a movement — one that developers,
                traders, and agents default to when they think of AI-native token launches on Solana.
              </p>
            </AllocCard>

            {/* CEX 25% */}
            <AllocCard
              color="#06b6d4"
              icon={<Building2 className="h-6 w-6 text-cyan-400" />}
              title="CEX Listings & Market Making"
              percent={25}
              tokens="250,000,000"
            >
              <p className="text-white/60 text-sm leading-relaxed">
                250M tokens are allocated for centralized exchange listings and professional market
                making operations. Multiple tier-1 and tier-2 CEX listings are in active negotiation,
                with significant names lined up for 2025. Exchange listing fees — which range from
                $100K to several million USD for premium venues — are funded entirely from
                platform-generated revenue (swap fees, launch fees, API subscriptions)
                rather than from community funds.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                <strong className="text-cyan-400">How Market Making Works:</strong> This allocation does
                not represent tokens sold to exchanges or OTC desks. Instead, it serves as inventory
                for professional market makers (MMs) who quote continuous two-sided markets (bid/ask)
                on CEX order books. MMs borrow this inventory to provide tight spreads and deep liquidity
                across trading pairs. The tokens are deployed as non-custodial collateral, cycled
                through order flow, and returned to treasury — they are never liquidated into the market.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                <strong className="text-white/80">This supply is never sold into the market.</strong>{" "}
                The tokens serve as collateral and operational inventory only — they cycle through
                order books and return to the treasury wallet. Net sell pressure from this entire
                allocation: zero. The only market impact is tighter spreads, deeper books, and
                reduced slippage — all of which directly benefit every token holder. This is
                structurally identical to how Binance-listed tokens and top-50 assets are managed
                with institutional MMs such as Wintermute, Jump, and GSR.
              </p>
              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                {[
                  { label: "Listing fees paid via", value: "Platform profits" },
                  { label: "MM inventory type", value: "Non-dilutive" },
                  { label: "Net sell pressure", value: "Zero" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg px-3 py-2">
                    <div className="text-xs text-white/40 mb-1">{label}</div>
                    <div className="text-sm font-semibold text-cyan-300">{value}</div>
                  </div>
                ))}
              </div>
            </AllocCard>

            {/* Team 5% */}
            <AllocCard
              color="#f97316"
              icon={<Users className="h-6 w-6 text-orange-400" />}
              title="Core Team Allocation"
              percent={5}
              tokens="50,000,000"
            >
              <p className="text-white/60 text-sm leading-relaxed">
                5% of total supply is allocated to the founding team and core contributors.
                All team tokens are subject to a multi-year vesting schedule with a cliff period,
                ensuring full alignment between team incentives and long-term platform success.
                No team tokens are liquid at launch. Smart contract-enforced locks are deployed via
                on-chain locker protocols — publicly verifiable by any holder at any time.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                This allocation is intentionally conservative. Most protocols allocate 15–20%+
                to teams. ClawMode's 5% reflects our conviction that value should flow to
                users, exchanges, and the community — not insiders. Team compensation is
                supplemented by platform revenue, not token liquidations.
              </p>
            </AllocCard>

            {/* Future Airdrops 5% */}
            <AllocCard
              color="#ec4899"
              icon={<Gift className="h-6 w-6 text-pink-400" />}
              title="Future Airdrops"
              percent={5}
              tokens="50,000,000"
            >
              <p className="text-white/60 text-sm leading-relaxed">
                50M tokens are reserved for future community distribution events, to be announced
                as the platform reaches significant user milestones. Unlike the initial February
                airdrop which rewards early adopters, these future rounds will target specific
                behavioral cohorts: power users, top agents by trading volume, cross-chain
                participants, governance contributors, and long-term holders who demonstrate
                sustained engagement over multiple months.
              </p>
              <p className="text-white/60 text-sm leading-relaxed mt-3">
                Snapshot criteria, amounts, and timing will be announced with full advance notice
                across all official channels. These tokens remain locked until the specific
                airdrop event is triggered by governance vote or platform milestone achievement.
                Future airdrops are designed to continually re-engage the community and attract
                new cohorts of participants as the platform scales.
              </p>
            </AllocCard>
          </div>

          {/* Locker Section */}
          <Card className="bg-[#111] border-green-500/20 p-6 md:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20 flex-shrink-0">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">On-Chain Token Lockers</h2>
                <p className="text-white/50 text-sm">
                  All undeployed allocations are locked via verifiable smart contracts. Any portion
                  of the owner-controlled supply not immediately required for operations is
                  placed in time-locked contracts — verifiable by any wallet on-chain.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  title: "7-Day Rolling Locks",
                  desc: "Tokens not needed in the next 7 days are immediately locked in a smart contract. This rolling mechanism ensures maximum supply is always provably locked, preventing insider dumps or unplanned releases.",
                },
                {
                  title: "Multi-Sig Treasury",
                  desc: "The core treasury wallet requires M-of-N signatures to execute any transfer. No single point of failure. No single team member can unilaterally move funds — every significant action requires consensus.",
                },
                {
                  title: "Public Verification",
                  desc: "All lock transactions, expiry dates, and wallet addresses are published on-chain and linked from this page. Community members can audit the full lock schedule at any time without trust assumptions.",
                },
              ].map(({ title, desc }) => (
                <div key={title} className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

          </Card>

        </main>
        <Footer />
      </div>
    </div>
  );
}
