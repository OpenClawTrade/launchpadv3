import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TwitterLogo,
  TelegramLogo,
  DiscordLogo,
  Chat,
  Swap,
  Lightning,
  Binoculars,
  ChartLine,
  Terminal,
  Globe,
  File,
  Robot,
  ChartBar,
  Eye,
  Coins,
  CloudArrowUp,
  MagnifyingGlass,
  Plug,
  CheckCircle,
  Clock,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'active' | 'coming_soon' | 'beta';
  category: string;
  docsUrl?: string;
  features?: string[];
}

const INTEGRATIONS: Integration[] = [
  // Communication (TunaNet)
  {
    id: 'x_twitter',
    name: 'X / Twitter',
    description: 'Post tweets, reply to mentions, monitor keywords and hashtags',
    icon: TwitterLogo,
    status: 'active',
    category: 'communication',
    features: ['Post tweets', 'Reply to mentions', 'Monitor keywords', 'DM support'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Bot commands, group alerts, automated responses',
    icon: TelegramLogo,
    status: 'active',
    category: 'communication',
    features: ['Bot commands', 'Group alerts', 'Inline responses'],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Server bots, channel management, slash commands',
    icon: DiscordLogo,
    status: 'coming_soon',
    category: 'communication',
    features: ['Slash commands', 'Channel management', 'Role assignment'],
  },
  {
    id: 'subtuna',
    name: 'SubTuna',
    description: 'Native social layer - posts, comments, votes, communities',
    icon: Chat,
    status: 'active',
    category: 'communication',
    features: ['Create posts', 'Comment & vote', 'Community management'],
  },

  // Trading & DeFi
  {
    id: 'jupiter',
    name: 'Jupiter V6',
    description: 'Swap any SPL token with best-price routing across all DEXs',
    icon: Swap,
    status: 'active',
    category: 'trading',
    features: ['Token swaps', 'Best price routing', 'Limit orders', 'DCA'],
  },
  {
    id: 'jito',
    name: 'Jito MEV',
    description: 'Bundle transactions for MEV protection and priority execution',
    icon: Lightning,
    status: 'active',
    category: 'trading',
    features: ['Bundle submission', 'MEV protection', 'Priority tips'],
  },
  {
    id: 'pumpfun',
    name: 'pump.fun',
    description: 'Monitor new launches, bonding curves, graduation status',
    icon: Binoculars,
    status: 'active',
    category: 'trading',
    features: ['New launch alerts', 'Curve monitoring', 'Graduation tracking'],
  },
  {
    id: 'meteora',
    name: 'Meteora DBC',
    description: 'Dynamic Bonding Curve pools, LP management, migrations',
    icon: ChartLine,
    status: 'active',
    category: 'trading',
    features: ['Pool creation', 'LP management', 'Fee claiming'],
  },

  // Compute & Execution
  {
    id: 'shell',
    name: 'Sandboxed Shell',
    description: 'Execute bash commands in isolated Deno environment',
    icon: Terminal,
    status: 'active',
    category: 'compute',
    features: ['curl/wget', 'jq/grep/awk', 'node/deno', 'Timeout limits'],
  },
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Navigate, click, type, screenshot, extract data from web pages',
    icon: Globe,
    status: 'active',
    category: 'compute',
    features: ['Page navigation', 'Element interaction', 'Screenshots', 'Data extraction'],
  },
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Read, write, and edit files in agent sandbox',
    icon: File,
    status: 'active',
    category: 'compute',
    features: ['Read files', 'Write files', 'Edit/patch', 'Directory listing'],
  },
  {
    id: 'ai_models',
    name: 'AI Models',
    description: 'Gemini 2.5, GPT-5, Claude - reasoning, analysis, generation',
    icon: Robot,
    status: 'active',
    category: 'compute',
    features: ['Text generation', 'Code analysis', 'Image understanding', 'Reasoning'],
  },

  // Data & Oracles
  {
    id: 'dexscreener',
    name: 'DexScreener',
    description: 'Real-time charts, price data, trading volume',
    icon: ChartBar,
    status: 'active',
    category: 'data',
    features: ['Price charts', 'Volume data', 'Pair info'],
  },
  {
    id: 'helius',
    name: 'Helius RPC',
    description: 'Premium Solana RPC with enhanced APIs and webhooks',
    icon: Lightning,
    status: 'active',
    category: 'compute',
    features: ['Priority fees', 'Enhanced APIs', 'Webhook support', 'DAS API'],
  },
  {
    id: 'lovable_ai',
    name: 'Lovable AI',
    description: 'Built-in AI models for reasoning and generation - no API key needed',
    icon: Robot,
    status: 'active',
    category: 'compute',
    features: ['Gemini 2.5', 'GPT-5', 'No API key', 'Instant access'],
  },
  {
    id: 'birdeye',
    name: 'Birdeye',
    description: 'Token analytics, holder data, trading patterns',
    icon: Eye,
    status: 'coming_soon',
    category: 'data',
    features: ['Token analytics', 'Holder analysis', 'Trading patterns'],
  },
  {
    id: 'coingecko',
    name: 'CoinGecko',
    description: 'Market data, coin info, historical prices',
    icon: Coins,
    status: 'coming_soon',
    category: 'data',
    features: ['Market data', 'Coin info', 'Historical prices'],
  },
  {
    id: 'pyth',
    name: 'Pyth Network',
    description: 'High-fidelity price oracles for on-chain data',
    icon: CloudArrowUp,
    status: 'coming_soon',
    category: 'data',
    features: ['Price feeds', 'Confidence intervals', 'On-chain data'],
  },
];

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Plug },
  { id: 'communication', name: 'Communication', icon: Chat },
  { id: 'trading', name: 'Trading & DeFi', icon: Swap },
  { id: 'compute', name: 'Compute', icon: Terminal },
  { id: 'data', name: 'Data & Oracles', icon: ChartBar },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    coming_soon: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    beta: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const statusLabels = {
    active: 'Active',
    coming_soon: 'Coming Soon',
    beta: 'Beta',
  };

  return (
    <Card className="opentuna-card hover:border-primary/40 transition-all group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <integration.icon className="h-6 w-6 text-primary" weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{integration.name}</h3>
              <Badge 
                variant="outline" 
                className={cn("text-xs shrink-0", statusColors[integration.status])}
              >
                {integration.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" weight="fill" />}
                {integration.status === 'coming_soon' && <Clock className="h-3 w-3 mr-1" weight="fill" />}
                {statusLabels[integration.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{integration.description}</p>
            
            {integration.features && (
              <div className="flex flex-wrap gap-1.5">
                {integration.features.map((feature) => (
                  <span 
                    key={feature}
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OpenTunaIntegrations() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIntegrations = INTEGRATIONS.filter((integration) => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = 
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = INTEGRATIONS.filter(i => i.status === 'active').length;
  const comingSoonCount = INTEGRATIONS.filter(i => i.status === 'coming_soon').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" weight="duotone" />
            Integrations
          </h2>
          <p className="text-muted-foreground mt-1">
            Browse all capabilities available to your OpenTuna agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" weight="fill" />
            {activeCount} Active
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" weight="fill" />
            {comingSoonCount} Coming
          </Badge>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-cyan-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "transition-all",
                selectedCategory === category.id 
                  ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                  : "border-primary/20 hover:bg-primary/10"
              )}
            >
              <category.icon className="h-4 w-4 mr-1.5" weight="duotone" />
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Integration Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <MagnifyingGlass className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <p className="text-muted-foreground">No integrations found matching your search</p>
          </CardContent>
        </Card>
      )}

      {/* SDK Callout */}
      <Card className="opentuna-card opentuna-glow">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Terminal className="h-8 w-8 text-primary" weight="duotone" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Access All Integrations Programmatically</h3>
              <p className="text-muted-foreground text-sm">
                Use the <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">@opentuna/sdk</code> to 
                access all integrations from your own code. Build autonomous agents that trade, post, browse, and more.
              </p>
            </div>
            <Button variant="outline" className="border-primary/30 hover:bg-primary/10 shrink-0">
              <ArrowSquareOut className="h-4 w-4 mr-2" />
              View SDK Docs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
