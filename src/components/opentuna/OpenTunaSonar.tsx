import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  WifiHigh,
  Fish,
  Lightning,
  Clock,
  CurrencyCircleDollar,
  Pause,
  Play,
  Check,
  Spinner
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useOpenTunaContext } from "./OpenTunaContext";
import { useOpenTunaSonarConfig, useOpenTunaSonarPings, useUpdateOpenTunaSonar } from "@/hooks/useOpenTuna";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type SonarMode = 'drift' | 'cruise' | 'hunt' | 'frenzy';

interface ModeOption {
  mode: SonarMode;
  label: string;
  interval: string;
  cost: string;
  description: string;
}

const SONAR_MODES: ModeOption[] = [
  { mode: 'drift', label: 'Drift', interval: '60 min', cost: '~$0.50/day', description: 'Low activity monitoring' },
  { mode: 'cruise', label: 'Cruise', interval: '15 min', cost: '~$2.00/day', description: 'Standard operation' },
  { mode: 'hunt', label: 'Hunt', interval: '5 min', cost: '~$8.00/day', description: 'Active trading/research' },
  { mode: 'frenzy', label: 'Frenzy', interval: '1 min', cost: '~$40.00/day', description: 'Maximum activity' },
];

export default function OpenTunaSonar() {
  const { selectedAgentId, agents } = useOpenTunaContext();
  const { data: sonarConfig, isLoading: configLoading } = useOpenTunaSonarConfig(selectedAgentId);
  const { data: pings, isLoading: pingsLoading } = useOpenTunaSonarPings(selectedAgentId, 10);
  const updateSonar = useUpdateOpenTunaSonar();
  const { toast } = useToast();
  
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [maxCostInput, setMaxCostInput] = useState("0.5");
  const [showCostEdit, setShowCostEdit] = useState(false);

  const selectedMode = (sonarConfig?.mode as SonarMode) || 'cruise';
  const isPaused = sonarConfig?.is_paused ?? true;

  useEffect(() => {
    if (sonarConfig) {
      setMaxCostInput(String(sonarConfig.max_daily_cost_sol || 0.5));
    }
  }, [sonarConfig]);

  const handleModeChange = (mode: SonarMode) => {
    if (!selectedAgentId) return;
    updateSonar.mutate({ agentId: selectedAgentId, mode });
  };

  const handleTogglePause = () => {
    if (!selectedAgentId) return;
    updateSonar.mutate({ 
      agentId: selectedAgentId, 
      isPaused: !isPaused,
      pausedReason: !isPaused ? 'Manually paused by user' : undefined,
    });
  };

  const handleTestPing = async () => {
    if (!selectedAgentId) return;
    
    setIsTestingPing(true);
    try {
      const { data, error } = await supabase.functions.invoke('opentuna-sonar-ping', {
        body: { agentId: selectedAgentId, forcePing: true },
      });

      if (error) throw error;

      toast({
        title: "Ping Executed",
        description: `Action: ${data.decision?.action} (Priority: ${data.decision?.priority})`,
      });
    } catch (error: any) {
      toast({
        title: "Ping Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleUpdateMaxCost = () => {
    if (!selectedAgentId) return;
    const cost = parseFloat(maxCostInput);
    if (isNaN(cost) || cost <= 0) return;
    
    updateSonar.mutate({ agentId: selectedAgentId, maxDailyCostSol: cost });
    setShowCostEdit(false);
  };

  // No agent selected
  if (!selectedAgentId || agents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Fish className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <h3 className="text-lg font-semibold mb-2">No Agents to Configure</h3>
            <p className="text-muted-foreground">Hatch an agent first to configure Sonar</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Spinner className="h-8 w-8 text-cyan-400 mx-auto animate-spin" />
            <p className="text-muted-foreground mt-2">Loading Sonar configuration...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Agent Info */}
      {selectedAgent && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <WifiHigh className="h-6 w-6 text-cyan-400" weight="duotone" />
            <div>
              <p className="font-semibold">{selectedAgent.name}</p>
              <p className="text-xs text-muted-foreground">
                Mode: {selectedMode} • {sonarConfig?.interval_minutes || 15}min intervals
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="secondary"
            onClick={handleTestPing}
            disabled={isTestingPing}
          >
            {isTestingPing ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Lightning className="h-4 w-4 mr-1" weight="fill" />
                Test Ping
              </>
            )}
          </Button>
        </div>
      )}

      {/* Mode Selector */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiHigh className="h-5 w-5 text-cyan-400" weight="duotone" />
            Select Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SONAR_MODES.map((option) => (
              <button
                key={option.mode}
                onClick={() => handleModeChange(option.mode)}
                disabled={updateSonar.isPending}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  "hover:border-cyan-500/50 hover:bg-cyan-500/5",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedMode === option.mode 
                    ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30" 
                    : "border-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{option.label}</span>
                  {selectedMode === option.mode && (
                    <Check className="h-4 w-4 text-cyan-400" />
                  )}
                </div>
                <p className="text-lg font-bold text-cyan-400">{option.interval}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.cost}</p>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            {SONAR_MODES.find(m => m.mode === selectedMode)?.description}
          </p>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" weight="duotone" />
              Current Status
            </span>
            <Button
              variant={isPaused ? "default" : "secondary"}
              size="sm"
              onClick={handleTogglePause}
              disabled={updateSonar.isPending}
              className={isPaused ? "opentuna-button" : ""}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-1" weight="fill" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" weight="fill" />
                  Pause
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Last Ping</p>
              <p className="text-lg font-semibold">
                {sonarConfig?.last_ping_at 
                  ? formatDistanceToNow(new Date(sonarConfig.last_ping_at), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Next Ping</p>
              <p className="text-lg font-semibold">
                {sonarConfig?.next_ping_at && !isPaused
                  ? formatDistanceToNow(new Date(sonarConfig.next_ping_at), { addSuffix: true })
                  : 'Paused'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Daily Cost</p>
              <p className="text-lg font-semibold">
                {(sonarConfig?.current_daily_cost_sol || 0).toFixed(4)} SOL{' '}
                <span className="text-sm text-muted-foreground">
                  / {sonarConfig?.max_daily_cost_sol || 0.5} SOL limit
                </span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Total Pings</p>
              <p className="text-lg font-semibold">{sonarConfig?.total_pings || 0}</p>
            </div>
          </div>
          
          {isPaused && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                <Pause className="h-4 w-4 inline mr-1" weight="fill" />
                Sonar is paused. {sonarConfig?.paused_reason || 'Agent will not make autonomous decisions.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Pings */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightning className="h-5 w-5 text-yellow-400" weight="duotone" />
            Recent Pings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pingsLoading ? (
            <div className="text-center py-4">
              <Spinner className="h-6 w-6 text-cyan-400 mx-auto animate-spin" />
            </div>
          ) : pings && pings.length > 0 ? (
            <div className="space-y-2">
              {pings.map((ping) => (
                <div 
                  key={ping.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground w-16">
                    {new Date(ping.executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <Badge variant="secondary" className="capitalize">
                    {ping.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{ping.reasoning || 'No reasoning provided'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">P:{ping.priority || 0}</span>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      ping.success ? "bg-green-400" : "bg-red-400"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Fish className="h-10 w-10 text-muted-foreground mx-auto mb-2" weight="duotone" />
              <p className="text-muted-foreground">No pings yet. Use "Test Ping" to trigger one.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Control */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CurrencyCircleDollar className="h-5 w-5 text-green-400" weight="duotone" />
            Cost Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm text-muted-foreground">Max Daily Cost</p>
              {showCostEdit ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={maxCostInput}
                    onChange={(e) => setMaxCostInput(e.target.value)}
                    className="w-24 h-8"
                    step="0.1"
                    min="0.01"
                  />
                  <span className="text-sm">SOL</span>
                </div>
              ) : (
                <p className="text-lg font-semibold">{sonarConfig?.max_daily_cost_sol || 0.5} SOL</p>
              )}
            </div>
            {showCostEdit ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowCostEdit(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="opentuna-button" onClick={handleUpdateMaxCost}>
                  Save
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowCostEdit(true)}>
                Adjust
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When daily cost reaches this limit, Sonar will pause until the next day
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
