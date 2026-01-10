import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Link2
} from "lucide-react";

interface RoadmapItem {
  title: string;
  description: string;
  icon: React.ElementType;
}

interface RoadmapPhase {
  id: "now" | "next" | "later";
  title: string;
  subtitle: string;
  items: RoadmapItem[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: "now",
    title: "Live Now",
    subtitle: "Shipped & Available",
    items: [
      { title: "Social Platform", description: "Posts, DMs, notifications, communities, profiles", icon: Users },
      { title: "Token Launchpad", description: "Create tokens with bonding curves & auto-graduation", icon: Rocket },
      { title: "Real-time Trading", description: "Instant buy/sell with live charts & history", icon: TrendingUp },
      { title: "Wallet Integration", description: "Auto Solana wallet creation on signup", icon: Wallet },
      { title: "Creator Earnings", description: "1% fee on all trades to token creators", icon: Sparkles },
      { title: "AI Assistant", description: "Built-in AI for platform help & crypto insights", icon: MessageSquare },
    ]
  },
  {
    id: "next",
    title: "Coming Q1 2026",
    subtitle: "In Development",
    items: [
      { title: "Quick Trading", description: "One-click preset amounts (0.1, 0.5, 1, 5 SOL)", icon: Zap },
      { title: "Limit Orders", description: "Set target prices for automatic execution", icon: Target },
      { title: "TRENCHES Pulse", description: "Real-time feed of new launches & graduating tokens", icon: BarChart3 },
      { title: "$TICKER Linking", description: "Token mentions become clickable trading links", icon: Link2 },
      { title: "Price Alerts", description: "Notifications when tokens hit target prices", icon: Bell },
      { title: "MEV Protection", description: "Jito bundles to prevent sandwich attacks", icon: Shield },
    ]
  },
  {
    id: "later",
    title: "Future Plans",
    subtitle: "Q2-Q3 2026",
    items: [
      { title: "Wallet Tracking", description: "Follow & copy successful traders", icon: Users },
      { title: "Token-Gated Content", description: "Exclusive posts for token holders", icon: Shield },
      { title: "Mobile App", description: "Native iOS & Android with push notifications", icon: Smartphone },
      { title: "Advanced Charts", description: "TradingView with professional indicators", icon: BarChart3 },
      { title: "Social Trading", description: "Share trades & build trading reputation", icon: Globe },
      { title: "Perps & Yield", description: "Leverage trading & staking integrations", icon: TrendingUp },
    ]
  }
];

const getPhaseStyles = (id: string) => {
  switch (id) {
    case "now":
      return {
        dot: "bg-green-500",
        badge: "bg-green-500/10 text-green-500 border-green-500/30",
        icon: CheckCircle2,
        iconColor: "text-green-500"
      };
    case "next":
      return {
        dot: "bg-yellow-500",
        badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
        icon: Clock,
        iconColor: "text-yellow-500"
      };
    default:
      return {
        dot: "bg-muted-foreground",
        badge: "bg-muted text-muted-foreground border-border",
        icon: Circle,
        iconColor: "text-muted-foreground"
      };
  }
};

export default function RoadmapPage() {
  return (
    <MainLayout>
      <div className="min-h-screen pb-20 md:pb-4">
        {/* Header */}
        <div className="border-b border-border px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Roadmap</h1>
          </div>
          <p className="text-muted-foreground">
            What we've built and what's coming next
          </p>
          
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">Building</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground" />
              <span className="text-sm">Planned</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-4 space-y-8">
          {roadmapPhases.map((phase) => {
            const styles = getPhaseStyles(phase.id);
            const StatusIcon = styles.icon;
            
            return (
              <div key={phase.id} className="relative">
                {/* Phase Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-4 h-4 rounded-full ${styles.dot} ring-4 ring-background`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold">{phase.title}</h2>
                      <Badge variant="outline" className={styles.badge}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${styles.iconColor}`} />
                        {phase.subtitle}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Features Grid */}
                <div className="ml-2 pl-5 border-l-2 border-border">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {phase.items.map((item) => (
                      <Card key={item.title} className="bg-card/50 hover:bg-card transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${phase.id === "now" ? "bg-green-500/10" : phase.id === "next" ? "bg-yellow-500/10" : "bg-muted"}`}>
                              <item.icon className={`h-4 w-4 ${phase.id === "now" ? "text-green-500" : phase.id === "next" ? "text-yellow-500" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <h3 className="font-medium text-sm">{item.title}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Overview */}
        <div className="p-4 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Platform Progress</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Social Features</span>
                <span className="text-green-500">95%</span>
              </div>
              <Progress value={95} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Trading Features</span>
                <span className="text-yellow-500">70%</span>
              </div>
              <Progress value={70} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Social + Trading Integration</span>
                <span className="text-muted-foreground">30%</span>
              </div>
              <Progress value={30} className="h-2" />
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="p-4 border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="text-2xl font-bold text-primary">30</div>
              <div className="text-xs text-muted-foreground">SOL Virtual Liquidity</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="text-2xl font-bold text-primary">85</div>
              <div className="text-xs text-muted-foreground">SOL to Graduate</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="text-2xl font-bold text-primary">2%</div>
              <div className="text-xs text-muted-foreground">Trading Fee</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <div className="text-2xl font-bold text-primary">1%</div>
              <div className="text-xs text-muted-foreground">Creator Earnings</div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
