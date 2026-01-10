import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Rocket, 
  Zap, 
  Users,
  TrendingUp,
  MessageSquare,
  Wallet,
  Target,
  Smartphone,
  CheckCircle2,
  Clock,
  Circle,
  Sparkles,
  BarChart3,
  Bell,
  Shield,
  Globe,
  Link2,
  Database,
  Server,
  Code,
  Lock,
  DollarSign,
  Eye,
  Search,
  Share2,
  Bot
} from "lucide-react";

// ==================== LIVE FEATURES ====================
const liveFeatures = {
  social: [
    "Posts with text, images, and video (mp4, webm, mov, avi)",
    "Like, repost, quote, and bookmark posts",
    "Threaded replies and conversations",
    "Follow/unfollow with real-time counts",
    "Direct messaging with media support",
    "Notifications (likes, follows, replies, mentions)",
    "Profile customization (avatar, cover, bio, links)",
    "Verified badges (Premium, Gold, Blue)",
    "Explore page with search",
    "Trending topics algorithm",
    "Who to follow suggestions",
    "Communities creation and membership",
    "Mute and block users",
    "Report system for content moderation",
    "View count tracking (50% visibility threshold)",
    "AI chat assistant"
  ],
  launchpad: [
    "Token creation with custom metadata",
    "Bonding curve trading (constant product x·y=k)",
    "Real-time price charts (1-minute candles)",
    "Transaction history with on-chain verification",
    "Automatic graduation to Meteora DAMM V2",
    "Creator fee distribution (50% of 2% trading fee)",
    "Token comments and discussions",
    "Holder tracking with real-time balances",
    "Portfolio dashboard for holdings",
    "Earnings dashboard for fee claims"
  ]
};

// ==================== ECONOMIC PARAMETERS ====================
const economicParams = [
  { label: "Initial Virtual Liquidity", value: "30 SOL", description: "Starting virtual SOL in bonding curve" },
  { label: "Graduation Threshold", value: "85 SOL", description: "Real SOL reserves needed to graduate" },
  { label: "Total Token Supply", value: "1,000,000,000", description: "Tokens minted per launch" },
  { label: "Token Decimals", value: "6", description: "SPL token decimal places" },
  { label: "Trading Fee", value: "2%", description: "Fee charged on each trade" },
  { label: "Creator Fee Share", value: "50% (1%)", description: "Creator receives 50% of trading fee" },
  { label: "Platform Fee Share", value: "50% (1%)", description: "Platform receives 50% of trading fee" },
  { label: "Post-Graduation Fee", value: "2%", description: "Fee on DAMM V2 pool trades" },
  { label: "LP Token Lockup", value: "100%", description: "All LP locked to treasury wallet" },
];

// ==================== ARCHITECTURE ====================
const architectureLayers = [
  {
    title: "Frontend",
    icon: Globe,
    tech: "React + Vite + TypeScript",
    components: [
      "LaunchpadPage.tsx — Token discovery & filtering",
      "LaunchTokenPage.tsx — Token creation flow",
      "TokenDetailPage.tsx — Trading interface + charts",
      "PortfolioPage.tsx — Holdings dashboard",
      "EarningsPage.tsx — Fee claim management"
    ]
  },
  {
    title: "API Layer",
    icon: Server,
    tech: "Vercel Node.js + Meteora SDK",
    components: [
      "/api/pool/create — DBC pool creation",
      "/api/swap/execute — On-chain swap execution",
      "/api/fees/claim — Creator fee claims",
      "/api/data/sync — External data synchronization"
    ]
  },
  {
    title: "Database",
    icon: Database,
    tech: "Supabase PostgreSQL + Realtime",
    components: [
      "tokens — Metadata, reserves, status",
      "token_holdings — Wallet balances per token",
      "launchpad_transactions — Buy/sell history",
      "token_price_history — OHLCV candle data",
      "token_comments — Threaded discussions",
      "fee_earners — Creator/system fee tracking"
    ]
  },
  {
    title: "On-Chain",
    icon: Lock,
    tech: "Solana + Helius RPC",
    components: [
      "Meteora DBC — Bonding curve pools",
      "Meteora DAMM V2 — Graduated liquidity pools",
      "SPL Token Program — Token operations",
      "Treasury Wallet — LP lockup & fees"
    ]
  }
];

// ==================== ROADMAP PHASES ====================
interface RoadmapFeature {
  name: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface RoadmapPhase {
  id: string;
  title: string;
  timeline: string;
  status: "live" | "in-progress" | "planned";
  description: string;
  features: RoadmapFeature[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: "phase-1",
    title: "Core Trading Enhancement",
    timeline: "Q1 2026",
    status: "in-progress",
    description: "Advanced order types and trading interface improvements",
    features: [
      { name: "Quick Buy/Sell Buttons", description: "One-click trading with preset amounts (0.1, 0.5, 1, 5 SOL) and sell percentages (25%, 50%, 75%, 100%)", priority: "HIGH" },
      { name: "Limit Orders", description: "Set target buy/sell prices with off-chain order book and on-chain settlement", priority: "HIGH" },
      { name: "Stop-Loss Orders", description: "Automatic sell when price drops below threshold", priority: "HIGH" },
      { name: "Take-Profit Orders", description: "Automatic sell when price reaches target", priority: "HIGH" },
      { name: "Custom Slippage", description: "User-adjustable slippage tolerance (0.1% - 50%)", priority: "HIGH" },
      { name: "MEV Protection", description: "Jito bundle routing to prevent sandwich attacks", priority: "HIGH" },
      { name: "Priority Fees", description: "Configurable priority fee for faster transaction inclusion", priority: "MEDIUM" },
      { name: "DCA Orders", description: "Scheduled recurring buys with cron-based execution", priority: "MEDIUM" },
    ]
  },
  {
    id: "phase-2",
    title: "Discovery & Analytics",
    timeline: "Q1-Q2 2026",
    status: "planned",
    description: "Token discovery dashboard and wallet tracking features",
    features: [
      { name: "TRENCHES Pulse", description: "Real-time token lifecycle tracking with New Launches, Bonding Progress, Recently Graduated, and Trending sections", priority: "HIGH" },
      { name: "Smart Filters", description: "Filter by Top 10 Holders %, Dev Holding %, Sniper %, Insider %, Bundle %, Pro Trader %", priority: "HIGH" },
      { name: "Wallet Tracking", description: "Monitor any Solana wallet with trade history, PnL analysis, and alerts", priority: "MEDIUM" },
      { name: "Copy Trading", description: "Auto-execute trades from tracked wallets with configurable delay and limits", priority: "MEDIUM" },
      { name: "$TICKER Auto-Linking", description: "Token mentions in posts become clickable links to trading pages", priority: "HIGH" },
      { name: "Social Score", description: "Token ranking based on social engagement and mention velocity", priority: "MEDIUM" },
      { name: "In-Feed Trading", description: "Buy/sell tokens directly from post cards in the feed", priority: "MEDIUM" },
    ]
  },
  {
    id: "phase-3",
    title: "Advanced Trading Tools",
    timeline: "Q2 2026",
    status: "planned",
    description: "Detection systems and professional charting",
    features: [
      { name: "Sniper Detection", description: "Identify first-block buys with high allocation (🎯 badge)", priority: "MEDIUM" },
      { name: "Bundler Detection", description: "Detect coordinated trading from multiple wallets in same tx (📦 badge)", priority: "MEDIUM" },
      { name: "Insider Detection", description: "Flag pre-launch wallet activity (🔒 badge)", priority: "MEDIUM" },
      { name: "Buy on Migration", description: "Auto-buy when token graduates from bonding curve to DAMM V2", priority: "HIGH" },
      { name: "Migration Alerts", description: "Push notifications when watched tokens graduate", priority: "HIGH" },
      { name: "TradingView Charts", description: "Professional charting with RSI, MACD, Bollinger Bands, Volume Profile", priority: "MEDIUM" },
      { name: "Trade Markers", description: "Show your trades on the price chart", priority: "LOW" },
    ]
  },
  {
    id: "phase-4",
    title: "Platform Expansion",
    timeline: "Q2-Q3 2026",
    status: "planned",
    description: "Fee sharing, leverage, and yield products",
    features: [
      { name: "Multi-Earner Fee Sharing", description: "Split creator fees with up to 100 addresses including Twitter handle resolution", priority: "MEDIUM" },
      { name: "Referral Fees", description: "Share trading fees with users who refer buyers", priority: "MEDIUM" },
      { name: "Token-Gated Communities", description: "Exclusive content and chat for token holders", priority: "MEDIUM" },
      { name: "Perp Trading", description: "Up to 50x leverage via Hyperliquid integration", priority: "LOW" },
      { name: "SOL Staking", description: "Jito liquid staking (jitoSOL) integration", priority: "LOW" },
      { name: "USDC Yield", description: "Marginfi lending integration", priority: "LOW" },
    ]
  },
  {
    id: "phase-5",
    title: "Mobile & Notifications",
    timeline: "Q3 2026",
    status: "planned",
    description: "Native mobile apps and comprehensive alerts",
    features: [
      { name: "Mobile App", description: "React Native app for iOS and Android with shared codebase", priority: "MEDIUM" },
      { name: "Biometric Auth", description: "Face ID / Fingerprint for secure trading", priority: "MEDIUM" },
      { name: "Push Notifications", description: "Price alerts, wallet activity, social mentions, order fills", priority: "HIGH" },
      { name: "Home Screen Widgets", description: "Price tickers and portfolio overview", priority: "LOW" },
    ]
  }
];

// ==================== SOCIAL INTEGRATION ====================
const socialIntegrations = [
  { social: "Posts", launchpad: "Embed token cards, $TICKER auto-linking" },
  { social: "Profiles", launchpad: "Display created tokens, trading history, PnL" },
  { social: "Notifications", launchpad: "Token mentions, follower trades, price alerts" },
  { social: "Trending", launchpad: "Token leaderboard by social velocity" },
  { social: "Communities", launchpad: "Token-gated access for holders" },
  { social: "DMs", launchpad: "Trade discussions, deal negotiations" },
  { social: "Verified Badges", launchpad: "Premium traders, top creators" },
  { social: "AI Assistant", launchpad: "Trading advice, token analysis" },
];

// ==================== HELPER FUNCTIONS ====================
const getStatusColor = (status: string) => {
  switch (status) {
    case "live": return "bg-green-500/10 text-green-500 border-green-500/30";
    case "in-progress": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "live": return CheckCircle2;
    case "in-progress": return Clock;
    default: return Circle;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "HIGH": return "text-red-400";
    case "MEDIUM": return "text-yellow-400";
    default: return "text-muted-foreground";
  }
};

// ==================== COMPONENT ====================
export default function RoadmapPage() {
  return (
    <MainLayout>
      <div className="min-h-screen pb-20 md:pb-4">
        {/* Header */}
        <div className="border-b border-border px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">TRENCHES Technical Roadmap</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Comprehensive development roadmap for the TRENCHES platform — combining social media with token trading infrastructure.
          </p>
        </div>

        <Tabs defaultValue="overview" className="p-4">
          <TabsList className="w-full justify-start mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="economics">Economics</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Live Features */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <CardTitle>Social Platform</CardTitle>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 ml-auto">
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {liveFeatures.social.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <CardTitle>Token Launchpad</CardTitle>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 ml-auto">
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {liveFeatures.launchpad.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Social Integration Matrix */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-purple-500" />
                  <CardTitle>Social + Launchpad Integration</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Unique advantage: Deep integration between social features and token trading
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {socialIntegrations.map((item) => (
                    <div key={item.social} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                      <Badge variant="outline" className="text-xs">{item.social}</Badge>
                      <span className="text-sm text-muted-foreground">{item.launchpad}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ARCHITECTURE TAB */}
          <TabsContent value="architecture" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {architectureLayers.map((layer) => (
                <Card key={layer.title}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <layer.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{layer.title}</CardTitle>
                    </div>
                    <Badge variant="outline" className="w-fit text-xs">{layer.tech}</Badge>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {layer.components.map((component) => (
                        <li key={component} className="text-sm text-muted-foreground font-mono">
                          {component}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Treasury Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <CardTitle>Treasury Wallet</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <code className="text-sm bg-secondary px-3 py-2 rounded block break-all">
                  7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2
                </code>
                <p className="text-sm text-muted-foreground mt-2">
                  All LP tokens are locked to this treasury. Platform fees are collected here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROADMAP TAB */}
          <TabsContent value="roadmap" className="space-y-6">
            {roadmapPhases.map((phase) => {
              const StatusIcon = getStatusIcon(phase.status);
              return (
                <Card key={phase.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-5 w-5 ${phase.status === "live" ? "text-green-500" : phase.status === "in-progress" ? "text-yellow-500" : "text-muted-foreground"}`} />
                        <div>
                          <CardTitle>{phase.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{phase.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{phase.timeline}</Badge>
                        <Badge variant="outline" className={getStatusColor(phase.status)}>
                          {phase.status === "live" ? "Live" : phase.status === "in-progress" ? "In Progress" : "Planned"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {phase.features.map((feature) => (
                        <div key={feature.name} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-sm">{feature.name}</h4>
                            <span className={`text-xs font-medium ${getPriorityColor(feature.priority)}`}>
                              {feature.priority}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Timeline Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Release Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-yellow-500">Q1 2026</p>
                    <ul className="text-muted-foreground ml-4 mt-1 space-y-1">
                      <li>• Jan: Quick Buy/Sell UI, Slippage Controls</li>
                      <li>• Feb: Limit Orders, Stop-Loss/Take-Profit</li>
                      <li>• Mar: TRENCHES Pulse v1, Basic Wallet Tracking</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Q2 2026</p>
                    <ul className="text-muted-foreground ml-4 mt-1 space-y-1">
                      <li>• Apr: Sniper/Bundler Detection, Migration Tools</li>
                      <li>• May: Advanced Charts, Social Integration v2</li>
                      <li>• Jun: Fee Sharing System, Notification System</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Q3 2026</p>
                    <ul className="text-muted-foreground ml-4 mt-1 space-y-1">
                      <li>• Jul: Mobile App Beta (iOS/Android)</li>
                      <li>• Aug: Copy Trading, Pro Trader Signals</li>
                      <li>• Sep: Perp Trading Integration, Yield Products</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ECONOMICS TAB */}
          <TabsContent value="economics" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle>Bonding Curve Economics</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Constant product formula (x · y = k) with virtual liquidity
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {economicParams.map((param) => (
                    <div key={param.label} className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <p className="text-xs text-muted-foreground">{param.label}</p>
                      <p className="text-lg font-bold text-primary">{param.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fee Flow */}
            <Card>
              <CardHeader>
                <CardTitle>Fee Distribution Flow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="p-3 rounded-lg bg-secondary/50 text-center flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Trade Amount</p>
                    <p className="font-bold">100%</p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground">Trading Fee</p>
                    <p className="font-bold text-yellow-500">2%</p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex-1 space-y-2 min-w-[200px]">
                    <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                      <p className="text-xs text-muted-foreground">Creator</p>
                      <p className="font-bold text-green-500">1% (50%)</p>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                      <p className="text-xs text-muted-foreground">Platform</p>
                      <p className="font-bold text-blue-500">1% (50%)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Success Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Target Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Metric</th>
                        <th className="text-center py-2 font-medium">Q1 Target</th>
                        <th className="text-center py-2 font-medium">Q2 Target</th>
                        <th className="text-center py-2 font-medium">Q3 Target</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2">Daily Active Traders</td>
                        <td className="text-center py-2">1,000</td>
                        <td className="text-center py-2">5,000</td>
                        <td className="text-center py-2">15,000</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Daily Trading Volume</td>
                        <td className="text-center py-2">$100K</td>
                        <td className="text-center py-2">$1M</td>
                        <td className="text-center py-2">$10M</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Tokens Launched</td>
                        <td className="text-center py-2">100</td>
                        <td className="text-center py-2">1,000</td>
                        <td className="text-center py-2">5,000</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Graduation Rate</td>
                        <td className="text-center py-2">10%</td>
                        <td className="text-center py-2">15%</td>
                        <td className="text-center py-2">20%</td>
                      </tr>
                      <tr>
                        <td className="py-2">Creator Fee Claims</td>
                        <td className="text-center py-2">$10K</td>
                        <td className="text-center py-2">$100K</td>
                        <td className="text-center py-2">$500K</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
