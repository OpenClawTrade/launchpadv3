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
  Egg
} from "@phosphor-icons/react";
import { useOpenTunaContext } from "./OpenTunaContext";
import { useOpenTunaStats } from "@/hooks/useOpenTuna";
import { cn } from "@/lib/utils";

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

export default function OpenTunaHub({ onNavigate }: OpenTunaHubProps) {
  const { agents, isLoadingAgents, setSelectedAgentId } = useOpenTunaContext();
  const { data: stats, isLoading: isLoadingStats } = useOpenTunaStats();
  
  const STATS = [
    { label: "Active Agents", value: isLoadingStats ? "—" : (stats?.totalAgents?.toString() || "0"), icon: Fish, color: "text-cyan-400" },
    { label: "Pings Today", value: isLoadingStats ? "—" : (stats?.totalPingsToday?.toString() || "0"), icon: Lightning, color: "text-yellow-400" },
    { label: "Economy Volume", value: isLoadingStats ? "— SOL" : `${stats?.economyVolume?.toFixed(2) || "0"} SOL`, icon: CurrencyCircleDollar, color: "text-green-400" },
    { label: "Avg Uptime", value: isLoadingStats ? "—%" : `${stats?.avgUptime || 99}%`, icon: Clock, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <Card key={stat.label} className="opentuna-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
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

      {/* Quick Start */}
      <Card className="opentuna-card opentuna-glow">
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-cyan-500/20 transition-all group"
              >
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
                <div className="text-left">
                  <p className="text-sm font-medium group-hover:text-cyan-400 transition-colors">{item.label}</p>
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
          <Gear className="h-5 w-5 text-cyan-400" weight="duotone" />
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
          className="opentuna-card mt-4 cursor-pointer hover:scale-[1.01] transition-all bg-gradient-to-br from-cyan-500/20 to-teal-600/10 border-cyan-500/30"
          onClick={() => onNavigate('hatch')}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-background/50">
                <Gear className="h-6 w-6 text-cyan-400" weight="duotone" />
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
          <Fish className="h-5 w-5 text-cyan-400" weight="duotone" />
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
                className="opentuna-card cursor-pointer hover:scale-[1.02] transition-all"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  onNavigate('dna');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Fish className="h-6 w-6 text-cyan-400" weight="duotone" />
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

      {/* Recent Activity (Placeholder) */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lightning className="h-5 w-5 text-yellow-400" weight="duotone" />
          Recent Activity
        </h2>
        <Card className="opentuna-card">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center text-sm">
              Activity will appear here once agents start working
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
