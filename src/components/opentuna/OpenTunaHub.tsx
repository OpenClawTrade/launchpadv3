import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Fish, 
  Lightning, 
  CurrencyCircleDollar, 
  Clock,
  ChartLineUp,
  ChatCircle,
  MagnifyingGlass,
  PaintBrush,
  Gear,
  ArrowRight,
  Egg,
  Terminal,
  Code,
  Key,
  Copy,
  Check,
  ArrowSquareOut
} from "@phosphor-icons/react";
import { useOpenTunaContext } from "./OpenTunaContext";
import { useOpenTunaStats, useRecentActivity } from "@/hooks/useOpenTuna";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import OpenTunaApiKeyModal from "./OpenTunaApiKeyModal";
import { formatDistanceToNow } from "date-fns";

interface OpenTunaHubProps {
  onNavigate: (tab: string) => void;
}

const AGENT_TYPES = [
  { 
    type: "trading", 
    name: "Trading", 
    icon: ChartLineUp, 
    description: "Autonomous pump.fun trader with Jupiter V6 + Jito MEV protection",
    color: "from-green-500/20 to-green-600/10 border-green-500/30"
  },
  { 
    type: "social", 
    name: "Social", 
    icon: ChatCircle, 
    description: "Community manager for SubTuna and X with personality-driven engagement",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30"
  },
  { 
    type: "research", 
    name: "Research", 
    icon: MagnifyingGlass, 
    description: "Data aggregator and analyst with web browsing and pattern detection",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30"
  },
  { 
    type: "creative", 
    name: "Creative", 
    icon: PaintBrush, 
    description: "Content generator for memes, images, and viral marketing",
    color: "from-pink-500/20 to-pink-600/10 border-pink-500/30"
  },
];

const QUICK_START_STEPS = [
  { step: 1, label: "Hatch", description: "Create your agent", tab: "hatch" },
  { step: 2, label: "DNA", description: "Configure personality", tab: "dna" },
  { step: 3, label: "Sonar", description: "Set activity mode", tab: "sonar" },
  { step: 4, label: "Fins", description: "Install capabilities", tab: "fins" },
  { step: 5, label: "Fund", description: "Deposit SOL & activate", tab: "current" },
];

const SDK_TABS = [
  { id: 'sdk', label: 'SDK', icon: Code },
  { id: 'api', label: 'API', icon: Terminal },
  { id: 'keys', label: 'API Keys', icon: Key },
];

const SDK_CODE = `import { OpenClaw } from '@openclaw/sdk';

// Initialize with your API key
const agent = new OpenClaw({ 
  apiKey: 'oca_live_...' 
});

// Use fins programmatically
await agent.fins.trade({ 
  action: 'buy', 
  tokenMint: 'So11...',
  amountSol: 0.1 
});

// Browse the web
await agent.fins.browse({ 
  action: 'navigate', 
  url: 'https://pump.fun' 
});

// Store in memory
await agent.memory.store({ 
  content: 'Trade executed', 
  type: 'anchor' 
});`;

const API_CODE = `# Get agent info
curl -X GET 'https://clawmode.lovable.app/api/agents/info' \\
  -H 'Authorization: Bearer oca_live_...'

# Execute a trade
curl -X POST 'https://clawmode.lovable.app/api/fins/trade' \\
  -H 'Authorization: Bearer oca_live_...' \\
  -H 'Content-Type: application/json' \\
  -d '{"action": "buy", "tokenMint": "...", "amountSol": 0.1}'

# Store memory
curl -X POST 'https://clawmode.lovable.app/api/memory/store' \\
  -H 'Authorization: Bearer oca_live_...' \\
  -d '{"content": "...", "type": "anchor"}'`;

export default function OpenTunaHub({ onNavigate }: OpenTunaHubProps) {
  const { agents, isLoadingAgents, setSelectedAgentId, selectedAgentId, selectedAgent } = useOpenTunaContext();
  const { data: stats, isLoading: isLoadingStats } = useOpenTunaStats();
  const [sdkTab, setSdkTab] = useState<'sdk' | 'api' | 'keys'>('sdk');
  const [copied, setCopied] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  
  // Fetch recent activity for all agents
  const agentIds = agents.map(a => a.id);
  const { data: recentActivity = [], isLoading: isLoadingActivity } = useRecentActivity(agentIds, 10);
  
  const STATS = [
    { label: "Active Agents", value: isLoadingStats ? "—" : (stats?.totalAgents?.toString() || "0"), icon: Fish, color: "text-primary" },
    { label: "Pings Today", value: isLoadingStats ? "—" : (stats?.totalPingsToday?.toString() || "0"), icon: Lightning, color: "text-yellow-400" },
    { label: "Economy Volume", value: isLoadingStats ? "— SOL" : `${stats?.economyVolume?.toFixed(2) || "0"} SOL`, icon: CurrencyCircleDollar, color: "text-green-400" },
    { label: "Avg Uptime", value: isLoadingStats ? "—%" : `${stats?.avgUptime || 99}%`, icon: Clock, color: "text-blue-400" },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Get agent name for activity display
  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* API Key Modal */}
      <OpenTunaApiKeyModal
        open={apiKeyModalOpen}
        onOpenChange={setApiKeyModalOpen}
        agentId={selectedAgentId}
        agentName={selectedAgent?.name}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <Card key={stat.label} className="opentuna-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} weight="duotone" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Developer Quick Start */}
      <Card className="opentuna-card opentuna-glow overflow-hidden">
        <CardHeader className="pb-3 border-b border-primary/20">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" weight="duotone" />
            Developer Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex gap-1 ml-4">
                {SDK_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSdkTab(tab.id as any)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                      sdkTab === tab.id
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" weight="duotone" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(sdkTab === 'sdk' ? 'npm install @opentuna/sdk' : API_CODE)}
              className="h-7 text-xs"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 mr-1 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {/* Install Command */}
          {sdkTab !== 'keys' && (
            <div className="px-4 py-3 bg-black/30 font-mono text-sm border-b border-primary/10">
              <span className="text-muted-foreground">$</span>{' '}
              <span className="text-primary">
                {sdkTab === 'sdk' ? 'npm install @opentuna/sdk' : 'curl -X GET https://clawmode.fun/api/...'}
              </span>
            </div>
          )}

          {/* Code Content */}
          <div className="p-4 bg-black/20">
            {sdkTab === 'sdk' && (
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                <code>{SDK_CODE}</code>
              </pre>
            )}
            {sdkTab === 'api' && (
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                <code>{API_CODE}</code>
              </pre>
            )}
            {sdkTab === 'keys' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate API keys to access OpenTuna programmatically. Keys are linked to your agents.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    variant="outline" 
                    className="border-primary/30 hover:bg-primary/10"
                    onClick={() => setApiKeyModalOpen(true)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Generate New Key
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-primary/30 hover:bg-primary/10"
                    onClick={() => setApiKeyModalOpen(true)}
                  >
                    <ArrowSquareOut className="h-4 w-4 mr-2" />
                    View All Keys
                  </Button>
                </div>
                {!selectedAgentId && agents.length > 0 && (
                  <p className="text-xs text-yellow-400">
                    💡 Select an agent first to manage its API keys
                  </p>
                )}
                {agents.length === 0 && (
                  <p className="text-xs text-yellow-400">
                    💡 Hatch an agent first to generate API keys
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="px-4 py-3 bg-secondary/20 border-t border-primary/10 flex flex-wrap gap-3">
            <Button 
              variant="link" 
              className="text-primary p-0 h-auto text-sm"
              onClick={() => onNavigate('docs')}
            >
              <ArrowSquareOut className="h-3.5 w-3.5 mr-1" />
              Full SDK Documentation
            </Button>
            <Button 
              variant="link" 
              className="text-primary p-0 h-auto text-sm"
              onClick={() => onNavigate('integrations')}
            >
              <ArrowSquareOut className="h-3.5 w-3.5 mr-1" />
              Browse Integrations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Steps */}
      <Card className="opentuna-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightning className="h-5 w-5 text-yellow-400" weight="fill" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {QUICK_START_STEPS.map((item, index) => (
              <button
                key={item.step}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-primary/20 transition-all group"
              >
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <div className="text-left">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                {index < QUICK_START_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-2 hidden sm:block" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Agent Types */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Gear className="h-5 w-5 text-primary" weight="duotone" />
          Agent Types
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {AGENT_TYPES.map((agent) => (
            <Card 
              key={agent.type}
              className={`opentuna-card cursor-pointer hover:scale-[1.02] transition-all bg-gradient-to-br ${agent.color}`}
              onClick={() => onNavigate('hatch')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-background/50">
                    <agent.icon className="h-6 w-6 text-foreground" weight="duotone" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* General Purpose Card */}
        <Card 
          className="opentuna-card mt-4 cursor-pointer hover:scale-[1.01] transition-all bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-primary/30"
          onClick={() => onNavigate('hatch')}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-background/50">
                <Gear className="h-6 w-6 text-primary" weight="duotone" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">General Purpose</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Full OpenClaw-level autonomy. Read/write files, browse web, execute commands, and trade. 
                  The most powerful agent type.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Agents */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Fish className="h-5 w-5 text-primary" weight="duotone" />
          Your Agents
        </h2>
        {isLoadingAgents ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : agents.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <Card 
                key={agent.id}
                className={cn(
                  "opentuna-card cursor-pointer hover:scale-[1.02] transition-all",
                  selectedAgentId === agent.id && "ring-2 ring-primary"
                )}
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  onNavigate('dna');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Fish className="h-6 w-6 text-primary" weight="duotone" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{agent.name}</h3>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs shrink-0",
                            agent.status === 'active' && "bg-green-500/20 text-green-400",
                            agent.status === 'pending' && "bg-yellow-500/20 text-yellow-400",
                            agent.status === 'paused' && "bg-orange-500/20 text-orange-400",
                          )}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">{agent.agent_type}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{agent.balance_sol?.toFixed(3) || 0} SOL</span>
                        <span>{agent.total_fin_calls || 0} fin calls</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="opentuna-card">
            <CardContent className="p-8 text-center">
              <Egg className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
              <p className="text-muted-foreground mb-4">No agents yet. Hatch your first one!</p>
              <Button 
                onClick={() => onNavigate('hatch')}
                className="opentuna-button"
              >
                <Egg className="h-4 w-4 mr-2" weight="duotone" />
                Hatch Agent
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity (Real Data) */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lightning className="h-5 w-5 text-yellow-400" weight="duotone" />
          Recent Activity
        </h2>
        <Card className="opentuna-card">
          <CardContent className="p-4">
            {isLoadingActivity ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((ping) => (
                  <div 
                    key={ping.id} 
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/30 transition-colors border-b border-primary/10 last:border-0"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      ping.success === true && "bg-green-400",
                      ping.success === false && "bg-red-400",
                      ping.success === null && "bg-yellow-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{ping.action}</p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {getAgentName(ping.agent_id)}
                        </Badge>
                      </div>
                      {ping.reasoning && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {ping.reasoning.slice(0, 80)}{ping.reasoning.length > 80 ? '...' : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ping.executed_at), { addSuffix: true })}
                      </span>
                      {ping.cost_sol > 0 && (
                        <p className="text-xs text-primary">{ping.cost_sol.toFixed(4)} SOL</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center text-sm py-4">
                Activity will appear here once agents start working
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
