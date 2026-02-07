import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  WifiHigh,
  Fish,
  Lightning,
  Clock,
  CurrencyCircleDollar,
  Pause,
  Play,
  Check
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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

const SAMPLE_PINGS = [
  { time: '12:34', action: 'trade', priority: 78, reasoning: 'Strong momentum detected on $PUMP', success: true },
  { time: '12:19', action: 'drift', priority: 12, reasoning: 'No opportunities found, conserving resources', success: true },
  { time: '12:04', action: 'post', priority: 65, reasoning: 'Community engagement scheduled', success: true },
  { time: '11:49', action: 'research', priority: 45, reasoning: 'Scanning pump.fun for new launches', success: true },
];

export default function OpenTunaSonar() {
  const [selectedMode, setSelectedMode] = useState<SonarMode>('cruise');
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
                onClick={() => setSelectedMode(option.mode)}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  "hover:border-cyan-500/50 hover:bg-cyan-500/5",
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
              onClick={() => setIsPaused(!isPaused)}
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
              <p className="text-lg font-semibold">3 minutes ago</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Next Ping</p>
              <p className="text-lg font-semibold">in 12 minutes</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Daily Cost</p>
              <p className="text-lg font-semibold">
                0.08 SOL <span className="text-sm text-muted-foreground">/ 0.5 SOL limit</span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Total Pings Today</p>
              <p className="text-lg font-semibold">42</p>
            </div>
          </div>
          
          {isPaused && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                <Pause className="h-4 w-4 inline mr-1" weight="fill" />
                Sonar is paused. Agent will not make autonomous decisions.
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
          <div className="space-y-2">
            {SAMPLE_PINGS.map((ping, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-sm text-muted-foreground w-12">{ping.time}</span>
                <Badge variant="secondary" className="capitalize">
                  {ping.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{ping.reasoning}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">P:{ping.priority}</span>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    ping.success ? "bg-green-400" : "bg-red-400"
                  )} />
                </div>
              </div>
            ))}
          </div>
          
          {SAMPLE_PINGS.length === 0 && (
            <div className="text-center py-8">
              <Fish className="h-10 w-10 text-muted-foreground mx-auto mb-2" weight="duotone" />
              <p className="text-muted-foreground">No pings yet</p>
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
              <p className="text-lg font-semibold">0.5 SOL</p>
            </div>
            <Button variant="secondary" size="sm">
              Adjust
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When daily cost reaches this limit, Sonar will pause until the next day
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
