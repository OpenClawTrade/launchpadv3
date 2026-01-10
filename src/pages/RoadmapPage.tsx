import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Rocket, 
  Zap, 
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Circle,
  Shield,
  Link2,
  DollarSign,
  RefreshCw,
  ArrowRight
} from "lucide-react";

// ==================== LIVE FEATURES ====================
const liveFeatures = {
  social: [
    "Posts with text, images, and video support",
    "Like, repost, quote, and bookmark functionality",
    "Threaded replies and conversations",
    "Follow system with real-time counts",
    "Direct messaging with media sharing",
    "Notifications for all interactions",
    "Profile customization with verification badges",
    "Explore page with advanced search",
    "Trending topics algorithm",
    "Who to follow recommendations",
    "Communities with membership management",
    "User moderation (mute, block, report)",
    "View count analytics",
    "AI-powered chat assistant"
  ],
  launchpad: [
    "Token creation with custom branding",
    "Bonding curve trading engine",
    "Real-time price charts with candlestick data",
    "On-chain transaction verification",
    "Automatic DEX graduation",
    "Creator fee distribution system",
    "Token discussion threads",
    "Holder tracking and analytics",
    "Portfolio management dashboard",
    "Earnings and fee claim interface"
  ]
};

// ==================== TOKENOMICS ====================
const tokenomics = {
  bondingCurve: [
    { label: "Initial Virtual Liquidity", value: "30 SOL" },
    { label: "Graduation Threshold", value: "85 SOL" },
    { label: "Total Token Supply", value: "1,000,000,000" },
    { label: "Token Decimals", value: "6" },
  ],
  fees: [
    { label: "Trading Fee", value: "2%", description: "Applied to each trade on bonding curve" },
    { label: "Creator Share", value: "1%", description: "50% of trading fee distributed to token creator" },
    { label: "Platform Share", value: "0.5%", description: "Platform operations and development" },
    { label: "$TRENCHES Buyback", value: "0.5%", description: "Automated buyback via smart contract" },
  ],
  postGraduation: [
    { label: "DAMM V2 Pool Fee", value: "2%" },
    { label: "LP Token Lockup", value: "100%" },
  ]
};

// ==================== ROADMAP PHASES ====================
interface RoadmapFeature {
  name: string;
  description: string;
}

interface RoadmapPhase {
  id: string;
  title: string;
  timeline: string;
  status: "live" | "in-progress" | "planned";
  features: RoadmapFeature[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: "phase-1",
    title: "Trading Enhancement",
    timeline: "Q1 2026",
    status: "in-progress",
    features: [
      { name: "Quick Buy/Sell", description: "Preset trade amounts and percentage-based selling" },
      { name: "Limit Orders", description: "Target price execution with on-chain settlement" },
      { name: "Stop-Loss & Take-Profit", description: "Automated position management" },
      { name: "Slippage Controls", description: "User-configurable tolerance settings" },
      { name: "MEV Protection", description: "Jito bundle routing for transaction security" },
      { name: "DCA Orders", description: "Scheduled recurring purchases" },
    ]
  },
  {
    id: "phase-2",
    title: "Discovery & Analytics",
    timeline: "Q1 2026",
    status: "in-progress",
    features: [
      { name: "TRENCHES Pulse", description: "Real-time token lifecycle monitoring" },
      { name: "Advanced Filters", description: "Holder distribution, dev allocation, trading patterns" },
      { name: "Wallet Tracking", description: "Monitor addresses with PnL analysis" },
      { name: "Copy Trading", description: "Automated trade mirroring with customizable parameters" },
      { name: "$TICKER Linking", description: "Token mentions as interactive trading links" },
      { name: "Social Scoring", description: "Engagement-based token rankings" },
    ]
  },
  {
    id: "phase-3",
    title: "Advanced Tools",
    timeline: "Q1 2026",
    status: "in-progress",
    features: [
      { name: "Pattern Detection", description: "Sniper, bundler, and insider identification" },
      { name: "Migration Automation", description: "Actions triggered on DEX graduation" },
      { name: "TradingView Integration", description: "Professional charting with technical indicators" },
      { name: "In-Feed Trading", description: "Execute trades directly from social posts" },
    ]
  },
  {
    id: "phase-4",
    title: "Platform Expansion",
    timeline: "Q1 2026",
    status: "in-progress",
    features: [
      { name: "Fee Sharing", description: "Multi-address revenue distribution" },
      { name: "Referral System", description: "Incentivized user acquisition" },
      { name: "Token-Gated Access", description: "Holder-exclusive content and communities" },
      { name: "Perpetual Trading", description: "Leverage trading via protocol integration" },
      { name: "Yield Products", description: "Staking and lending integrations" },
    ]
  },
  {
    id: "phase-5",
    title: "Mobile Platform",
    timeline: "Q1 2026",
    status: "in-progress",
    features: [
      { name: "Native Applications", description: "iOS and Android with biometric authentication" },
      { name: "Push Notifications", description: "Price alerts, trade confirmations, social activity" },
      { name: "Home Screen Widgets", description: "Portfolio and price monitoring" },
    ]
  }
];

// ==================== SOCIAL INTEGRATION ====================
const socialIntegrations = [
  { feature: "Token Cards in Posts", description: "Embed interactive token data in social content" },
  { feature: "Profile Trading Stats", description: "Display holdings, PnL, and trading history" },
  { feature: "Trading Notifications", description: "Alerts for price movements and follower activity" },
  { feature: "Social Trending", description: "Token rankings based on mention velocity" },
  { feature: "Holder Communities", description: "Token-gated groups and discussions" },
  { feature: "AI Trading Insights", description: "Automated analysis and recommendations" },
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

// ==================== COMPONENT ====================
export default function RoadmapPage() {
  return (
    <MainLayout>
      <div className="min-h-screen pb-20 md:pb-4">
        {/* Header */}
        <div className="border-b border-border px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Product Roadmap</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Strategic development plan for the TRENCHES platform — integrating social engagement with decentralized token trading.
          </p>
        </div>

        <Tabs defaultValue="roadmap" className="p-4">
          <TabsList className="w-full justify-start mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="roadmap">Development Roadmap</TabsTrigger>
            <TabsTrigger value="overview">Platform Overview</TabsTrigger>
            <TabsTrigger value="tokenomics">Tokenomics</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
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

            {/* Social + Trading Integration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-purple-500" />
                  <CardTitle>Platform Integration</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Unified experience connecting social engagement with token trading
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {socialIntegrations.map((item) => (
                    <div key={item.feature} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium text-sm mb-1">{item.feature}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
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
                        <CardTitle>{phase.title}</CardTitle>
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
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {phase.features.map((feature) => (
                        <div key={feature.name} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                          <h4 className="font-medium text-sm mb-1">{feature.name}</h4>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Release Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-4">
                    <Badge className="bg-yellow-500 text-black">Q1 2026</Badge>
                    <div>
                      <p className="font-medium">Complete Platform Launch</p>
                      <p className="text-muted-foreground">Trading enhancement, discovery tools, analytics, mobile apps, and platform expansion</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TOKENOMICS TAB */}
          <TabsContent value="tokenomics" className="space-y-6">
            {/* Bonding Curve Parameters */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Bonding Curve Parameters</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Constant product formula (x · y = k) with virtual liquidity initialization
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {tokenomics.bondingCurve.map((param) => (
                    <div key={param.label} className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{param.label}</p>
                      <p className="text-xl font-bold text-primary">{param.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fee Structure */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle>Fee Distribution</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {tokenomics.fees.map((fee) => (
                    <div key={fee.label} className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{fee.label}</p>
                      <p className="text-2xl font-bold text-primary mb-2">{fee.value}</p>
                      <p className="text-xs text-muted-foreground">{fee.description}</p>
                    </div>
                  ))}
                </div>

                {/* Fee Flow Diagram */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium mb-4">Fee Allocation Flow</h4>
                  <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
                    <div className="px-4 py-2 rounded-lg bg-background border">
                      <p className="text-xs text-muted-foreground">Trade Volume</p>
                      <p className="font-bold">100%</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-xs text-muted-foreground">Trading Fee</p>
                      <p className="font-bold text-yellow-500">2%</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-2">
                      <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                        <p className="text-xs text-muted-foreground">Creator</p>
                        <p className="font-bold text-green-500">1%</p>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                        <p className="text-xs text-muted-foreground">Platform</p>
                        <p className="font-bold text-blue-500">0.5%</p>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                        <p className="text-xs text-muted-foreground">$TRENCHES Buyback</p>
                        <p className="font-bold text-purple-500">0.5%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Buyback Mechanism */}
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-purple-500" />
                  <CardTitle>$TRENCHES Buyback Mechanism</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  0.5% of all launchpad trading volume is automatically allocated to $TRENCHES token buybacks, 
                  executed via smart contract to ensure transparent and consistent demand pressure.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                    <Zap className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Automated Execution</p>
                    <p className="text-sm font-medium">Smart Contract</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                    <Shield className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Allocation</p>
                    <p className="text-sm font-medium">0.5% of Volume</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                    <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Effect</p>
                    <p className="text-sm font-medium">Continuous Demand</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Post-Graduation */}
            <Card>
              <CardHeader>
                <CardTitle>Post-Graduation Economics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Parameters applied after token graduates to Meteora DAMM V2
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tokenomics.postGraduation.map((param) => (
                    <div key={param.label} className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{param.label}</p>
                      <p className="text-xl font-bold text-primary">{param.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
