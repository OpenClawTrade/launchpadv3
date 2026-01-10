import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  ArrowRight
} from "lucide-react";

// ==================== NOW-NEXT-LATER ROADMAP ====================

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ElementType;
}

interface RoadmapPhase {
  id: "now" | "next" | "later";
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
  items: RoadmapItem[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: "now",
    title: "Now",
    subtitle: "Live & Active",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    items: [
      { title: "Social Platform", description: "Full-featured social experience with posts, DMs, notifications, and communities", icon: Users },
      { title: "Token Launchpad", description: "Create and trade tokens on bonding curves with automatic graduation", icon: Rocket },
      { title: "Real-time Trading", description: "Instant buy/sell with live price charts and transaction history", icon: TrendingUp },
      { title: "Wallet Integration", description: "Automatic Solana wallet creation with seamless authentication", icon: Wallet },
      { title: "Creator Earnings", description: "Token creators earn 1% of all trading fees automatically", icon: Sparkles },
      { title: "AI Assistant", description: "Built-in AI chat for platform guidance and crypto insights", icon: MessageSquare },
    ]
  },
  {
    id: "next",
    title: "Next",
    subtitle: "Q1 2026",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    items: [
      { title: "Quick Trading", description: "One-click buy/sell with preset amounts (0.1, 0.5, 1, 5 SOL)", icon: Zap },
      { title: "Limit Orders", description: "Set target prices for automatic buy/sell execution", icon: Target },
      { title: "TRENCHES Pulse", description: "Real-time token discovery feed with new launches and graduating tokens", icon: BarChart3 },
      { title: "$TICKER Linking", description: "Token mentions in posts become clickable links to trading pages", icon: Link2 },
      { title: "Price Alerts", description: "Get notified when tokens hit your target prices", icon: Bell },
      { title: "MEV Protection", description: "Jito bundle routing to prevent sandwich attacks", icon: Shield },
    ]
  },
  {
    id: "later",
    title: "Later",
    subtitle: "Q2-Q3 2026",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    items: [
      { title: "Wallet Tracking", description: "Follow successful traders and copy their moves", icon: Users },
      { title: "Token-Gated Content", description: "Exclusive posts and communities for token holders", icon: Shield },
      { title: "Mobile App", description: "Native iOS and Android apps with push notifications", icon: Smartphone },
      { title: "Advanced Charts", description: "TradingView integration with professional indicators", icon: BarChart3 },
      { title: "Social Trading", description: "Share trades, track PnL, and build trading reputation", icon: Globe },
      { title: "Perps & Yield", description: "Leverage trading and staking integrations", icon: TrendingUp },
    ]
  }
];

// ==================== STRATEGIC THEMES ====================

interface Theme {
  id: string;
  title: string;
  tagline: string;
  description: string;
  progress: number;
  icon: React.ElementType;
  color: string;
  highlights: string[];
}

const strategicThemes: Theme[] = [
  {
    id: "social",
    title: "Social Experience",
    tagline: "Where communities form",
    description: "A complete social platform where crypto communities can connect, share, and grow together.",
    progress: 95,
    icon: Users,
    color: "text-blue-500",
    highlights: [
      "Posts, replies, reposts, quotes",
      "Direct messaging with media",
      "Follow graphs & notifications",
      "Community creation & discovery",
      "Profile customization & verification"
    ]
  },
  {
    id: "trading",
    title: "Token Trading",
    tagline: "Where tokens launch",
    description: "Fair launch platform with bonding curves, automatic DEX graduation, and creator revenue sharing.",
    progress: 70,
    icon: TrendingUp,
    color: "text-green-500",
    highlights: [
      "Bonding curve launches",
      "Real-time price charts",
      "Automatic DEX graduation",
      "Creator fee distribution",
      "Transaction history & analytics"
    ]
  },
  {
    id: "integration",
    title: "Social + Trading",
    tagline: "Where it all connects",
    description: "The unique TRENCHES advantage — deep integration between social engagement and token trading.",
    progress: 30,
    icon: Link2,
    color: "text-purple-500",
    highlights: [
      "Creator profiles linked to tokens",
      "$TICKER mentions (coming soon)",
      "In-feed trading (coming soon)",
      "Token-gated content (coming soon)",
      "Trade sharing (coming soon)"
    ]
  }
];

// ==================== COMPONENT ====================

function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
  return (
    <div className="relative">
      {/* Connection line */}
      {index < roadmapPhases.length - 1 && (
        <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border z-0">
          <ArrowRight className="absolute -right-1 -top-2 h-4 w-4 text-muted-foreground" />
        </div>
      )}
      
      <Card className={`h-full ${phase.borderColor} border-2`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${phase.bgColor}`}>
                {phase.id === "now" && <CheckCircle2 className={`h-5 w-5 ${phase.color}`} />}
                {phase.id === "next" && <Clock className={`h-5 w-5 ${phase.color}`} />}
                {phase.id === "later" && <Circle className={`h-5 w-5 ${phase.color}`} />}
              </div>
              <div>
                <CardTitle className={`text-xl ${phase.color}`}>{phase.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
              </div>
            </div>
            <Badge variant="outline" className={phase.bgColor}>
              {phase.items.length} features
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {phase.items.map((item) => (
            <div 
              key={item.title}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className={`p-1.5 rounded-md ${phase.bgColor}`}>
                <item.icon className={`h-4 w-4 ${phase.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{item.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-secondary`}>
              <theme.icon className={`h-6 w-6 ${theme.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{theme.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{theme.tagline}</p>
            </div>
          </div>
          <Badge variant="outline" className={theme.progress === 100 ? "bg-green-500/10 text-green-500" : ""}>
            {theme.progress}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{theme.description}</p>
        
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{theme.progress}%</span>
          </div>
          <Progress value={theme.progress} className="h-2" />
        </div>
        
        <div className="space-y-1.5">
          {theme.highlights.map((highlight) => (
            <div key={highlight} className="flex items-center gap-2 text-sm">
              {highlight.includes("coming soon") ? (
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              )}
              <span className={highlight.includes("coming soon") ? "text-muted-foreground" : ""}>
                {highlight}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoadmapPage() {
  const totalFeatures = roadmapPhases.reduce((acc, phase) => acc + phase.items.length, 0);
  const liveFeatures = roadmapPhases[0].items.length;

  return (
    <MainLayout>
      <div className="min-h-screen pb-20 md:pb-4">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-green-500/5" />
          <div className="relative px-4 py-8 md:py-12">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Product Roadmap</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mb-6">
              Building the first platform where social communities and token trading are deeply integrated. 
              Here's what we've shipped and what's coming next.
            </p>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="text-lg font-bold text-green-500">{liveFeatures}</span>
                <span className="text-sm text-muted-foreground ml-2">Live Now</span>
              </div>
              <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-lg font-bold text-yellow-500">{roadmapPhases[1].items.length}</span>
                <span className="text-sm text-muted-foreground ml-2">Coming Q1</span>
              </div>
              <div className="px-4 py-2 rounded-lg bg-muted border border-border">
                <span className="text-lg font-bold">{totalFeatures}</span>
                <span className="text-sm text-muted-foreground ml-2">Total Planned</span>
              </div>
            </div>
          </div>
        </div>

        {/* Now-Next-Later Timeline */}
        <div className="p-4 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Development Timeline</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Our Now-Next-Later framework keeps us focused while staying flexible
            </p>
            
            <div className="grid gap-6 lg:grid-cols-3">
              {roadmapPhases.map((phase, index) => (
                <PhaseCard key={phase.id} phase={phase} index={index} />
              ))}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Strategic Themes */}
          <div>
            <h2 className="text-xl font-semibold mb-1">Strategic Themes</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Three pillars that define the TRENCHES platform
            </p>
            
            <div className="grid gap-6 md:grid-cols-3">
              {strategicThemes.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Why TRENCHES is Different */}
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-3">Why TRENCHES is Different</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Other platforms are either social-only or trading-only. We're building both together, 
                creating unique features that aren't possible anywhere else.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-background/50 text-center">
                  <div className="text-3xl font-bold text-primary mb-1">1</div>
                  <p className="text-sm font-medium">Platform</p>
                  <p className="text-xs text-muted-foreground">Not two separate apps</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 text-center">
                  <div className="text-3xl font-bold text-primary mb-1">1%</div>
                  <p className="text-sm font-medium">Creator Fee</p>
                  <p className="text-xs text-muted-foreground">On every trade, forever</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 text-center">
                  <div className="text-3xl font-bold text-primary mb-1">85</div>
                  <p className="text-sm font-medium">SOL to Graduate</p>
                  <p className="text-xs text-muted-foreground">Fair launch for everyone</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Specs (Collapsed) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technical Foundation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">Blockchain</p>
                  <p className="font-medium">Solana</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">DEX</p>
                  <p className="font-medium">Meteora DAMM V2</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">Virtual Liquidity</p>
                  <p className="font-medium">30 SOL</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground">Trading Fee</p>
                  <p className="font-medium">2% (50/50 split)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
