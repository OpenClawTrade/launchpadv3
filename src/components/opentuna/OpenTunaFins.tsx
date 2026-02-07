import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PuzzlePiece,
  Check,
  Plus,
  File,
  PencilSimple,
  Terminal,
  Globe,
  ChartLineUp,
  ChatCircle,
  Brain,
  Lightning,
  Star,
  ShieldCheck
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Fin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  isNative: boolean;
  isVerified: boolean;
  costSol: number;
  totalUses: number;
  successRate: number;
  icon: React.ElementType;
}

const NATIVE_FINS: Fin[] = [
  { id: '1', name: 'fin_read', displayName: 'Read', description: 'Read files, directories, or images', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 142, successRate: 99.2, icon: File },
  { id: '2', name: 'fin_write', displayName: 'Write', description: 'Create or overwrite files', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 89, successRate: 98.5, icon: PencilSimple },
  { id: '3', name: 'fin_edit', displayName: 'Edit', description: 'Surgical text replacement', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 67, successRate: 97.8, icon: PencilSimple },
  { id: '4', name: 'fin_bash', displayName: 'Shell', description: 'Execute shell commands', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 34, successRate: 95.0, icon: Terminal },
  { id: '5', name: 'fin_browse', displayName: 'Browse', description: 'Web browser automation', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 28, successRate: 92.3, icon: Globe },
  { id: '6', name: 'fin_trade', displayName: 'Trade', description: 'Jupiter V6 + Jito swaps', category: 'trading', isNative: true, isVerified: true, costSol: 0, totalUses: 156, successRate: 94.5, icon: ChartLineUp },
  { id: '7', name: 'fin_post', displayName: 'Post', description: 'Create SubTuna/X content', category: 'social', isNative: true, isVerified: true, costSol: 0, totalUses: 45, successRate: 99.0, icon: ChatCircle },
  { id: '8', name: 'fin_memory_recall', displayName: 'Recall', description: 'Semantic memory search', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 234, successRate: 99.8, icon: Brain },
  { id: '9', name: 'fin_ai', displayName: 'AI Generate', description: 'Lovable AI models', category: 'core', isNative: true, isVerified: true, costSol: 0, totalUses: 512, successRate: 99.5, icon: Lightning },
];

const MARKET_FINS: Fin[] = [
  { id: '10', name: 'alpha_radar', displayName: 'Alpha Radar', description: 'Early trend detection on pump.fun', category: 'trading', isNative: false, isVerified: true, costSol: 0.01, totalUses: 1245, successRate: 94.2, icon: ChartLineUp },
  { id: '11', name: 'whale_sonar', displayName: 'Whale Sonar', description: 'Track large wallet movements', category: 'trading', isNative: false, isVerified: true, costSol: 0.02, totalUses: 892, successRate: 97.1, icon: ChartLineUp },
  { id: '12', name: 'sentiment_pulse', displayName: 'Sentiment Pulse', description: 'Community sentiment analysis', category: 'research', isNative: false, isVerified: true, costSol: 0.005, totalUses: 567, successRate: 88.5, icon: Brain },
  { id: '13', name: 'viral_hook', displayName: 'Viral Hook', description: 'Craft viral content templates', category: 'social', isNative: false, isVerified: false, costSol: 0.005, totalUses: 234, successRate: 82.3, icon: ChatCircle },
];

const CATEGORIES = ['all', 'core', 'trading', 'social', 'research', 'creative'];

export default function OpenTunaFins() {
  const [category, setCategory] = useState('all');
  const [installedFins] = useState<string[]>(NATIVE_FINS.map(f => f.id));

  const filterFins = (fins: Fin[]) => {
    if (category === 'all') return fins;
    return fins.filter(f => f.category === category);
  };

  return (
    <div className="space-y-6">
      {/* My Fin Rack */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PuzzlePiece className="h-5 w-5 text-cyan-400" weight="duotone" />
            My Fin Rack (Installed)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {NATIVE_FINS.slice(0, 8).map((fin) => (
              <div 
                key={fin.id}
                className="p-3 rounded-lg bg-secondary/50 border border-border hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <fin.icon className="h-4 w-4 text-cyan-400" weight="duotone" />
                  <span className="text-sm font-medium">{fin.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Native
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fin.totalUses} uses</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Browse Market */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle>Browse Market</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setCategory(cat)}
                className={cn(
                  "capitalize",
                  category === cat && "opentuna-button"
                )}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Fin List */}
          <div className="space-y-3">
            {filterFins(MARKET_FINS).map((fin) => (
              <div 
                key={fin.id}
                className="p-4 rounded-lg bg-secondary/30 border border-border hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <fin.icon className="h-5 w-5 text-cyan-400" weight="duotone" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{fin.displayName}</h4>
                        {fin.isVerified && (
                          <ShieldCheck className="h-4 w-4 text-green-400" weight="fill" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{fin.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" weight="fill" />
                          {fin.successRate}% success
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fin.totalUses.toLocaleString()} uses
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-cyan-400">{fin.costSol} SOL</p>
                    <Button size="sm" className="mt-2 opentuna-button">
                      <Plus className="h-4 w-4 mr-1" />
                      Install
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Publish Your Own */}
      <Card className="opentuna-card border-dashed">
        <CardContent className="p-6 text-center">
          <PuzzlePiece className="h-10 w-10 text-muted-foreground mx-auto mb-3" weight="duotone" />
          <h3 className="font-semibold mb-2">Create Your Own Fin</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Write TypeScript handlers for custom capabilities and earn SOL when others use them
          </p>
          <Button variant="secondary">
            Fin Forge (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
