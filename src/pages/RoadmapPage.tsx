import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Map, 
  Rocket, 
  Zap, 
  Search, 
  Wallet, 
  Bell, 
  Smartphone,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Users,
  Shield,
  DollarSign,
  BarChart3,
  MessageSquare,
  Globe
} from "lucide-react";

interface RoadmapPhase {
  id: string;
  title: string;
  quarter: string;
  status: "completed" | "in-progress" | "upcoming";
  progress: number;
  features: {
    name: string;
    description: string;
    status: "done" | "in-progress" | "planned";
    icon: React.ElementType;
  }[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: "current",
    title: "Core Infrastructure",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      {
        name: "Bonding Curve Engine",
        description: "Constant product (x·y=k), 30 SOL virtual liquidity",
        status: "done",
        icon: TrendingUp,
      },
      {
        name: "Graduation Mechanism",
        description: "Auto-migrate at 85 SOL to Meteora DAMM V2",
        status: "done",
        icon: Rocket,
      },
      {
        name: "Fee Distribution",
        description: "2% trading fee, 50/50 creator/platform split",
        status: "done",
        icon: DollarSign,
      },
      {
        name: "Real-time Price Charts",
        description: "1-minute candles with live updates",
        status: "done",
        icon: BarChart3,
      },
      {
        name: "Token Comments",
        description: "Threaded discussions per token",
        status: "done",
        icon: MessageSquare,
      },
      {
        name: "Holder Tracking",
        description: "Real-time balance updates for all holders",
        status: "done",
        icon: Users,
      },
    ],
  },
  {
    id: "phase1",
    title: "Core Trading Enhancement",
    quarter: "Q1 2026",
    status: "in-progress",
    progress: 25,
    features: [
      {
        name: "Advanced Order Types",
        description: "Limit orders, stop-loss, take-profit, DCA",
        status: "in-progress",
        icon: Target,
      },
      {
        name: "Quick Buy/Sell Interface",
        description: "One-click trades with preset amounts",
        status: "planned",
        icon: Zap,
      },
      {
        name: "Slippage & MEV Protection",
        description: "Jito bundle routing to prevent sandwich attacks",
        status: "planned",
        icon: Shield,
      },
      {
        name: "Transaction Retry",
        description: "Auto-retry with increased priority on failure",
        status: "planned",
        icon: Clock,
      },
    ],
  },
  {
    id: "phase2",
    title: "Discovery & Analytics",
    quarter: "Q1-Q2 2026",
    status: "upcoming",
    progress: 0,
    features: [
      {
        name: "TRENCHES Pulse",
        description: "Real-time token lifecycle tracking with smart filters",
        status: "planned",
        icon: Search,
      },
      {
        name: "Wallet Tracking",
        description: "Monitor and copy-trade successful wallets",
        status: "planned",
        icon: Wallet,
      },
      {
        name: "Social Integration",
        description: "$TICKER auto-linking, in-feed trading",
        status: "planned",
        icon: Globe,
      },
      {
        name: "Pro Trader Detection",
        description: "Smart money tracking and signals",
        status: "planned",
        icon: Users,
      },
    ],
  },
  {
    id: "phase3",
    title: "Advanced Trading Tools",
    quarter: "Q2 2026",
    status: "upcoming",
    progress: 0,
    features: [
      {
        name: "Sniper & Bundler Detection",
        description: "Identify suspicious trading patterns",
        status: "planned",
        icon: Target,
      },
      {
        name: "Migration Tools",
        description: "Auto buy/sell on token graduation",
        status: "planned",
        icon: Rocket,
      },
      {
        name: "TradingView Charts",
        description: "Professional charting with indicators",
        status: "planned",
        icon: BarChart3,
      },
      {
        name: "Fee Sharing System",
        description: "Split fees with up to 100 addresses",
        status: "planned",
        icon: DollarSign,
      },
    ],
  },
  {
    id: "phase4",
    title: "Mobile & UX",
    quarter: "Q3 2026",
    status: "upcoming",
    progress: 0,
    features: [
      {
        name: "Mobile App",
        description: "React Native app for iOS and Android",
        status: "planned",
        icon: Smartphone,
      },
      {
        name: "Push Notifications",
        description: "Price alerts, wallet activity, social mentions",
        status: "planned",
        icon: Bell,
      },
      {
        name: "Copy Trading",
        description: "Auto-execute trades from tracked wallets",
        status: "planned",
        icon: Users,
      },
      {
        name: "Perp Trading Integration",
        description: "Up to 50x leverage via Hyperliquid",
        status: "planned",
        icon: TrendingUp,
      },
    ],
  },
];

const technicalSpecs = [
  { label: "Initial Virtual SOL", value: "30 SOL" },
  { label: "Graduation Threshold", value: "85 SOL" },
  { label: "Total Token Supply", value: "1,000,000,000" },
  { label: "Token Decimals", value: "6" },
  { label: "Trading Fee", value: "2%" },
  { label: "Creator Fee Share", value: "50%" },
  { label: "System Fee Share", value: "50%" },
  { label: "Post-Graduation Fee", value: "2%" },
];

const successMetrics = [
  { metric: "Daily Active Traders", q1: "1,000", q2: "5,000", q3: "15,000" },
  { metric: "Daily Trading Volume", q1: "$100K", q2: "$1M", q3: "$10M" },
  { metric: "Tokens Launched", q1: "100", q2: "1,000", q3: "5,000" },
  { metric: "Graduation Rate", q1: "10%", q2: "15%", q3: "20%" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
    case "done":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "in-progress":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "done":
      return CheckCircle2;
    case "in-progress":
      return Clock;
    default:
      return Target;
  }
}

export default function RoadmapPage() {
  return (
    <MainLayout>
      <div className="min-h-screen">
        {/* Hero Header */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="relative px-4 py-8 md:py-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10">
                <Map className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Launchpad Roadmap</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Comprehensive development roadmap for the TRENCHES Launchpad, integrating 
              advanced trading features inspired by axiom.trade with our unique social platform.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          <Tabs defaultValue="roadmap" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
              <TabsTrigger value="technical">Technical Specs</TabsTrigger>
              <TabsTrigger value="metrics">Success Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="roadmap" className="mt-6 space-y-6">
              {roadmapPhases.map((phase) => (
                <Card key={phase.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{phase.title}</CardTitle>
                        <Badge variant="outline" className={getStatusColor(phase.status)}>
                          {phase.status === "completed" ? "Complete" : 
                           phase.status === "in-progress" ? "In Progress" : "Upcoming"}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground font-medium">
                        {phase.quarter}
                      </span>
                    </div>
                    {phase.status !== "upcoming" && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{phase.progress}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-2" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {phase.features.map((feature) => {
                        const StatusIcon = getStatusIcon(feature.status);
                        const FeatureIcon = feature.icon;
                        
                        return (
                          <div
                            key={feature.name}
                            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
                          >
                            <div className="p-2 rounded-lg bg-background">
                              <FeatureIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">{feature.name}</h4>
                                <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${
                                  feature.status === "done" ? "text-green-500" :
                                  feature.status === "in-progress" ? "text-yellow-500" :
                                  "text-muted-foreground"
                                }`} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {feature.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="technical" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Economic Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {technicalSpecs.map((spec) => (
                      <div
                        key={spec.label}
                        className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-center"
                      >
                        <p className="text-2xl font-bold text-primary">{spec.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{spec.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Architecture Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2">Frontend (React/Vite)</h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• LaunchpadPage.tsx → Token discovery & filtering</li>
                        <li>• LaunchTokenPage.tsx → bags.fm-style token creation</li>
                        <li>• TokenDetailPage.tsx → Trading interface + charts</li>
                        <li>• PortfolioPage.tsx → Holdings & earnings dashboard</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2">API Layer (Vercel Node.js)</h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• /api/pool/create → Meteora DBC pool creation</li>
                        <li>• /api/swap/execute → On-chain swap execution</li>
                        <li>• /api/fees/claim → Creator fee claims</li>
                        <li>• /api/data/sync → DexScreener data sync</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2">On-Chain (Solana)</h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• Meteora DBC → Bonding curve pools</li>
                        <li>• Meteora DAMM V2 → Graduated liquidity pools</li>
                        <li>• Helius RPC → High-performance node access</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Target Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium">Metric</th>
                          <th className="text-center py-3 px-4 font-medium">Q1 2026</th>
                          <th className="text-center py-3 px-4 font-medium">Q2 2026</th>
                          <th className="text-center py-3 px-4 font-medium">Q3 2026</th>
                        </tr>
                      </thead>
                      <tbody>
                        {successMetrics.map((row) => (
                          <tr key={row.metric} className="border-b border-border/50">
                            <td className="py-3 px-4 text-muted-foreground">{row.metric}</td>
                            <td className="text-center py-3 px-4 font-medium">{row.q1}</td>
                            <td className="text-center py-3 px-4 font-medium text-primary">{row.q2}</td>
                            <td className="text-center py-3 px-4 font-medium text-green-500">{row.q3}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">TRENCHES Unique Advantage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlike trading-only platforms, TRENCHES combines social media with token trading, 
                    enabling viral loops and organic discovery.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { feature: "Posts", integration: "Embed token cards, $TICKER auto-linking" },
                      { feature: "Profiles", integration: "Show created tokens, trading history, PnL" },
                      { feature: "Notifications", integration: "Token mentions, follower trades, price alerts" },
                      { feature: "Trending", integration: "Token leaderboard based on social velocity" },
                      { feature: "Communities", integration: "Token-gated communities for holders" },
                      { feature: "AI Assistant", integration: "Trading advice, token analysis, market insights" },
                    ].map((item) => (
                      <div key={item.feature} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                        <h4 className="font-medium text-sm">{item.feature}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.integration}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
