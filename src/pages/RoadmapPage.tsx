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
  Globe,
  Heart,
  Repeat,
  Bookmark,
  Image,
  Video,
  Hash,
  AtSign,
  Lock,
  Eye,
  Share2,
  Edit,
  Trash2,
  Flag,
  UserPlus,
  UserMinus,
  Sparkles,
  Bot,
  Crown,
  Megaphone,
  Link,
  Calendar,
  MapPin
} from "lucide-react";

interface Feature {
  name: string;
  description: string;
  status: "done" | "in-progress" | "planned";
  icon: React.ElementType;
}

interface RoadmapSection {
  id: string;
  title: string;
  quarter: string;
  status: "completed" | "in-progress" | "upcoming";
  progress: number;
  features: Feature[];
}

// ==================== SOCIAL PLATFORM ROADMAP ====================
const socialPlatformSections: RoadmapSection[] = [
  {
    id: "social-core",
    title: "Core Social Features",
    quarter: "Q3-Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Post Creation", description: "Text posts with 280 character limit", status: "done", icon: Edit },
      { name: "Image & Video Uploads", description: "Support for mp4, webm, mov, avi formats", status: "done", icon: Video },
      { name: "Like / Unlike", description: "Optimistic updates with real-time sync", status: "done", icon: Heart },
      { name: "Repost / Unrepost", description: "Share posts with your followers", status: "done", icon: Repeat },
      { name: "Quote Posts", description: "Embed posts with your commentary", status: "done", icon: MessageSquare },
      { name: "Bookmarks", description: "Save posts for later viewing", status: "done", icon: Bookmark },
      { name: "Threaded Replies", description: "Nested conversation threads", status: "done", icon: MessageSquare },
      { name: "Share Posts", description: "Web Share API + clipboard fallback", status: "done", icon: Share2 },
      { name: "View Counter", description: "Impression tracking at 50% visibility", status: "done", icon: Eye },
    ],
  },
  {
    id: "social-users",
    title: "User Interactions",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Follow / Unfollow", description: "Build your social graph", status: "done", icon: UserPlus },
      { name: "Mute Users", description: "Hide posts without unfollowing", status: "done", icon: UserMinus },
      { name: "Block Users", description: "Prevent all interaction", status: "done", icon: Shield },
      { name: "Report Posts/Users", description: "Flag content for moderation", status: "done", icon: Flag },
      { name: "Followers Modal", description: "View follower/following lists", status: "done", icon: Users },
    ],
  },
  {
    id: "social-profiles",
    title: "Profiles & Authentication",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Privy Auth", description: "Wallet, social, email login", status: "done", icon: Lock },
      { name: "Solana Wallet Auto-Creation", description: "Every user gets a wallet on signup", status: "done", icon: Wallet },
      { name: "Profile Editing", description: "Bio, location, website, avatar, cover", status: "done", icon: Edit },
      { name: "Profile Tabs", description: "Posts, Replies, Media, Likes views", status: "done", icon: Users },
      { name: "Verified Badges", description: "Premium, gold, and blue verification", status: "done", icon: Crown },
      { name: "Username Cooldown", description: "7-day restriction between changes", status: "done", icon: Clock },
    ],
  },
  {
    id: "social-discovery",
    title: "Discovery & Navigation",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Home Feed", description: "Real-time updates with Supabase", status: "done", icon: Globe },
      { name: "Explore Page", description: "Search posts, users, hashtags", status: "done", icon: Search },
      { name: "Trending Topics", description: "Algorithm based on post velocity", status: "done", icon: TrendingUp },
      { name: "Who to Follow", description: "Suggestions based on mutual follows", status: "done", icon: UserPlus },
      { name: "Hashtag Extraction", description: "#hashtags auto-linked and searchable", status: "done", icon: Hash },
      { name: "Cashtag Support", description: "$TICKER mentions for tokens", status: "done", icon: DollarSign },
    ],
  },
  {
    id: "social-messaging",
    title: "Messaging & Notifications",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Direct Messages", description: "Real-time 1:1 conversations", status: "done", icon: MessageSquare },
      { name: "Notifications", description: "Likes, follows, replies, reposts", status: "done", icon: Bell },
      { name: "Unread Counts", description: "Badge indicators on nav icons", status: "done", icon: Bell },
      { name: "Mark as Read", description: "Auto-mark when messages viewed", status: "done", icon: CheckCircle2 },
    ],
  },
  {
    id: "social-communities",
    title: "Communities & Admin",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Communities", description: "Create and join interest groups", status: "done", icon: Users },
      { name: "Admin Panel", description: "Report management dashboard", status: "done", icon: Shield },
      { name: "User Bans", description: "Platform-wide user restrictions", status: "done", icon: UserMinus },
      { name: "Post Pinning", description: "Admin-only global feed pins", status: "done", icon: Megaphone },
      { name: "Role-based Access", description: "Admin, moderator, user roles", status: "done", icon: Crown },
    ],
  },
  {
    id: "social-ai",
    title: "AI Features",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "TRENCHES AI Chat", description: "AI assistant powered by GPT", status: "done", icon: Bot },
      { name: "Contextual Help", description: "Platform guidance and tips", status: "done", icon: Sparkles },
    ],
  },
  {
    id: "social-future",
    title: "Social Platform Enhancements",
    quarter: "Q2-Q3 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "Scheduled Posts", description: "Queue posts for future publishing", status: "planned", icon: Calendar },
      { name: "Location Tagging", description: "Add location to posts", status: "planned", icon: MapPin },
      { name: "Polls", description: "Create interactive polls", status: "planned", icon: BarChart3 },
      { name: "Spaces/Audio Rooms", description: "Live audio conversations", status: "planned", icon: Megaphone },
      { name: "Lists", description: "Curated user collections", status: "planned", icon: Users },
    ],
  },
];

// ==================== LAUNCHPAD ROADMAP ====================
const launchpadSections: RoadmapSection[] = [
  {
    id: "launchpad-core",
    title: "Core Infrastructure",
    quarter: "Q4 2025",
    status: "completed",
    progress: 100,
    features: [
      { name: "Bonding Curve Engine", description: "Constant product (x·y=k), 30 SOL virtual liquidity", status: "done", icon: TrendingUp },
      { name: "Graduation Mechanism", description: "Auto-migrate at 85 SOL to Meteora DAMM V2", status: "done", icon: Rocket },
      { name: "Fee Distribution", description: "2% trading fee, 50/50 creator/platform split", status: "done", icon: DollarSign },
      { name: "LP Token Lockup", description: "100% LP locked to platform treasury", status: "done", icon: Lock },
      { name: "Real-time Price Charts", description: "1-minute candles with live updates", status: "done", icon: BarChart3 },
      { name: "Token Comments", description: "Threaded discussions per token", status: "done", icon: MessageSquare },
      { name: "Transaction History", description: "Full on-chain tx logging", status: "done", icon: Clock },
      { name: "Holder Tracking", description: "Real-time balance updates for all holders", status: "done", icon: Users },
    ],
  },
  {
    id: "launchpad-trading",
    title: "Core Trading Enhancement",
    quarter: "Q1 2026",
    status: "in-progress",
    progress: 25,
    features: [
      { name: "Limit Orders", description: "Set target buy/sell prices", status: "in-progress", icon: Target },
      { name: "Stop-Loss Orders", description: "Auto-sell at threshold", status: "planned", icon: Shield },
      { name: "Take-Profit Orders", description: "Auto-sell at target", status: "planned", icon: DollarSign },
      { name: "Quick Buy/Sell", description: "One-click trades with preset amounts", status: "planned", icon: Zap },
      { name: "MEV Protection", description: "Jito bundle routing to prevent sandwich attacks", status: "planned", icon: Shield },
      { name: "Custom Slippage", description: "User-adjustable (0.1% - 50%)", status: "planned", icon: BarChart3 },
    ],
  },
  {
    id: "launchpad-discovery",
    title: "Discovery & Analytics",
    quarter: "Q1-Q2 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "TRENCHES Pulse", description: "Real-time token lifecycle tracking", status: "planned", icon: Search },
      { name: "New Launches Feed", description: "Tokens < 5 min old with filters", status: "planned", icon: Rocket },
      { name: "Bonding Progress View", description: "Tokens 50-99% bonded", status: "planned", icon: TrendingUp },
      { name: "Wallet Tracking", description: "Monitor and copy-trade successful wallets", status: "planned", icon: Wallet },
      { name: "Pro Trader Detection", description: "Smart money tracking and signals", status: "planned", icon: Users },
      { name: "Social Score", description: "Token ranking by social engagement", status: "planned", icon: TrendingUp },
    ],
  },
  {
    id: "launchpad-advanced",
    title: "Advanced Trading Tools",
    quarter: "Q2 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "Sniper Detection", description: "First-block buy identification", status: "planned", icon: Target },
      { name: "Bundler Detection", description: "Coordinated trading patterns", status: "planned", icon: Users },
      { name: "Migration Alerts", description: "Notifications on token graduation", status: "planned", icon: Bell },
      { name: "Buy on Migration", description: "Auto-buy when token graduates", status: "planned", icon: Rocket },
      { name: "TradingView Charts", description: "Professional charting with indicators", status: "planned", icon: BarChart3 },
      { name: "Fee Sharing", description: "Split fees with up to 100 addresses", status: "planned", icon: Share2 },
    ],
  },
  {
    id: "launchpad-expansion",
    title: "Platform Expansion",
    quarter: "Q2-Q3 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "Perp Trading", description: "Up to 50x leverage via Hyperliquid", status: "planned", icon: TrendingUp },
      { name: "SOL Staking", description: "Jito liquid staking (jitoSOL)", status: "planned", icon: DollarSign },
      { name: "USDC Yield", description: "Marginfi lending integration", status: "planned", icon: DollarSign },
      { name: "LP Farming", description: "Stake graduated LP tokens", status: "planned", icon: Sparkles },
    ],
  },
];

// ==================== INTEGRATION ROADMAP ====================
const integrationSections: RoadmapSection[] = [
  {
    id: "integration-current",
    title: "Social + Launchpad Integration",
    quarter: "Q1 2026",
    status: "in-progress",
    progress: 40,
    features: [
      { name: "$TICKER Auto-linking", description: "Token mentions become clickable links", status: "in-progress", icon: Link },
      { name: "Creator Profiles", description: "Token creators linked to social profiles", status: "done", icon: Users },
      { name: "Token Cards in Feed", description: "Embed token info in posts", status: "planned", icon: Image },
      { name: "In-feed Trading", description: "Buy/sell directly from post cards", status: "planned", icon: Zap },
    ],
  },
  {
    id: "integration-advanced",
    title: "Deep Platform Integration",
    quarter: "Q2 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "Token-gated Communities", description: "Exclusive access for token holders", status: "planned", icon: Lock },
      { name: "Trading Notifications", description: "Follower trades, price alerts", status: "planned", icon: Bell },
      { name: "Social Trending Tokens", description: "Leaderboard by social velocity", status: "planned", icon: TrendingUp },
      { name: "AI Trading Insights", description: "Token analysis and market predictions", status: "planned", icon: Bot },
      { name: "Post-to-Token", description: "Create token from post idea", status: "planned", icon: Rocket },
    ],
  },
  {
    id: "integration-mobile",
    title: "Mobile & Cross-Platform",
    quarter: "Q3 2026",
    status: "upcoming",
    progress: 0,
    features: [
      { name: "Mobile App", description: "React Native for iOS and Android", status: "planned", icon: Smartphone },
      { name: "Push Notifications", description: "Price alerts, social mentions, trades", status: "planned", icon: Bell },
      { name: "Biometric Auth", description: "Face ID / Fingerprint for trading", status: "planned", icon: Lock },
      { name: "Home Screen Widgets", description: "Price tickers and portfolio", status: "planned", icon: BarChart3 },
    ],
  },
];

// Technical specs for both platforms
const socialTechSpecs = [
  { label: "Authentication", value: "Privy (Wallet, Twitter, Email)" },
  { label: "Database", value: "Supabase PostgreSQL" },
  { label: "Real-time", value: "Supabase Realtime" },
  { label: "File Storage", value: "Supabase Storage" },
  { label: "Edge Functions", value: "Deno Runtime" },
  { label: "Frontend", value: "React + Vite + TypeScript" },
  { label: "Styling", value: "Tailwind CSS + shadcn/ui" },
  { label: "State Management", value: "TanStack Query" },
];

const launchpadTechSpecs = [
  { label: "Initial Virtual SOL", value: "30 SOL" },
  { label: "Graduation Threshold", value: "85 SOL" },
  { label: "Total Token Supply", value: "1,000,000,000" },
  { label: "Token Decimals", value: "6" },
  { label: "Trading Fee", value: "2%" },
  { label: "Creator Fee Share", value: "50%" },
  { label: "System Fee Share", value: "50%" },
  { label: "DEX Integration", value: "Meteora DAMM V2" },
];

const featureParity = [
  { feature: "Post with text/images/video", status: "done" },
  { feature: "Like posts", status: "done" },
  { feature: "Retweet/Repost", status: "done" },
  { feature: "Quote tweet", status: "done" },
  { feature: "Bookmark", status: "done" },
  { feature: "Reply threads", status: "done" },
  { feature: "Follow/Unfollow", status: "done" },
  { feature: "Mute/Block", status: "done" },
  { feature: "Report", status: "done" },
  { feature: "Trending topics", status: "done" },
  { feature: "Who to follow", status: "done" },
  { feature: "Direct messages", status: "done" },
  { feature: "Notifications", status: "done" },
  { feature: "Profile with tabs", status: "done" },
  { feature: "Edit profile", status: "done" },
  { feature: "Avatar/Cover upload", status: "done" },
  { feature: "Verified badges", status: "done" },
  { feature: "View counts", status: "done" },
  { feature: "Communities", status: "done" },
  { feature: "Search", status: "done" },
  { feature: "Scheduled posts", status: "planned" },
  { feature: "Polls", status: "planned" },
  { feature: "Spaces/Audio", status: "planned" },
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

function RoadmapSectionCard({ section }: { section: RoadmapSection }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{section.title}</CardTitle>
            <Badge variant="outline" className={getStatusColor(section.status)}>
              {section.status === "completed" ? "Complete" : 
               section.status === "in-progress" ? "In Progress" : "Upcoming"}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {section.quarter}
          </span>
        </div>
        {section.status !== "upcoming" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{section.progress}%</span>
            </div>
            <Progress value={section.progress} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          {section.features.map((feature) => {
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
  );
}

export default function RoadmapPage() {
  const completedSocialFeatures = socialPlatformSections.filter(s => s.status === "completed").flatMap(s => s.features).length;
  const totalSocialFeatures = socialPlatformSections.flatMap(s => s.features).length;
  
  const completedLaunchpadFeatures = launchpadSections.filter(s => s.status === "completed").flatMap(s => s.features).length;
  const totalLaunchpadFeatures = launchpadSections.flatMap(s => s.features).length;

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
              <h1 className="text-2xl md:text-3xl font-bold">TRENCHES Roadmap</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mb-6">
              Complete development roadmap for the TRENCHES platform — a revolutionary combination of 
              social media and token trading with advanced trading tools.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-500">{completedSocialFeatures}</p>
                <p className="text-xs text-muted-foreground">Social Features Done</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-500">{completedLaunchpadFeatures}</p>
                <p className="text-xs text-muted-foreground">Launchpad Features Done</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-500">
                  {totalSocialFeatures + totalLaunchpadFeatures - completedSocialFeatures - completedLaunchpadFeatures}
                </p>
                <p className="text-xs text-muted-foreground">Features Planned</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-2xl font-bold text-primary">Q1 2026</p>
                <p className="text-xs text-muted-foreground">Full Platform Launch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          <Tabs defaultValue="social" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="social" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Social Platform</span>
                <span className="sm:hidden">Social</span>
              </TabsTrigger>
              <TabsTrigger value="launchpad" className="gap-2">
                <Rocket className="h-4 w-4" />
                <span className="hidden sm:inline">Launchpad</span>
                <span className="sm:hidden">Launch</span>
              </TabsTrigger>
              <TabsTrigger value="integration" className="gap-2">
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Integration</span>
                <span className="sm:hidden">Integrate</span>
              </TabsTrigger>
              <TabsTrigger value="technical" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Technical</span>
                <span className="sm:hidden">Tech</span>
              </TabsTrigger>
            </TabsList>

            {/* Social Platform Tab */}
            <TabsContent value="social" className="mt-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  {Math.round((completedSocialFeatures / totalSocialFeatures) * 100)}% Complete
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Full-featured social media platform
                </span>
              </div>
              {socialPlatformSections.map((section) => (
                <RoadmapSectionCard key={section.id} section={section} />
              ))}
            </TabsContent>

            {/* Launchpad Tab */}
            <TabsContent value="launchpad" className="mt-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  {Math.round((completedLaunchpadFeatures / totalLaunchpadFeatures) * 100)}% Complete
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Advanced token launchpad with trading tools
                </span>
              </div>
              {launchpadSections.map((section) => (
                <RoadmapSectionCard key={section.id} section={section} />
              ))}
            </TabsContent>

            {/* Integration Tab */}
            <TabsContent value="integration" className="mt-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Unique Advantage
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Social + Trading integration (no competitor has this)
                </span>
              </div>
              
              <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Why This Matters</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Unlike trading-only platforms or social-only platforms, TRENCHES combines both into 
                    a single platform. This creates viral loops where social engagement drives token discovery, 
                    and token trading drives social interaction.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-background/50">
                      <p className="font-medium">Trading Platforms</p>
                      <p className="text-xs text-muted-foreground">Trading only, no social layer</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50">
                      <p className="font-medium">Social Platforms</p>
                      <p className="text-xs text-muted-foreground">Social only, no native trading</p>
                    </div>
                    <div className="col-span-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="font-medium text-primary">TRENCHES</p>
                      <p className="text-xs text-muted-foreground">Full social + trading integration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {integrationSections.map((section) => (
                <RoadmapSectionCard key={section.id} section={section} />
              ))}
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Social Platform Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {socialTechSpecs.map((spec) => (
                        <div
                          key={spec.label}
                          className="p-3 rounded-lg bg-secondary/50 border border-border/50"
                        >
                          <p className="font-medium text-sm">{spec.value}</p>
                          <p className="text-xs text-muted-foreground">{spec.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-primary" />
                      Launchpad Economics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {launchpadTechSpecs.map((spec) => (
                        <div
                          key={spec.label}
                          className="p-3 rounded-lg bg-secondary/50 border border-border/50"
                        >
                          <p className="font-medium text-sm text-primary">{spec.value}</p>
                          <p className="text-xs text-muted-foreground">{spec.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Social Platform Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {featureParity.map((item) => (
                      <div
                        key={item.feature}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30"
                      >
                        {item.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{item.feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Architecture Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        Frontend
                      </h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• React 18 + Vite</li>
                        <li>• TypeScript strict mode</li>
                        <li>• Tailwind CSS + shadcn/ui</li>
                        <li>• TanStack Query v5</li>
                        <li>• React Router v6</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Backend
                      </h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• Supabase PostgreSQL</li>
                        <li>• Edge Functions (Deno)</li>
                        <li>• Vercel API (Node.js)</li>
                        <li>• Supabase Realtime</li>
                        <li>• Row Level Security</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        On-Chain
                      </h4>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        <li>• Solana blockchain</li>
                        <li>• Meteora DBC (bonding)</li>
                        <li>• Meteora DAMM V2 (DEX)</li>
                        <li>• Helius RPC</li>
                        <li>• Privy authentication</li>
                      </ul>
                    </div>
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
