import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Brain,
  MagnifyingGlass,
  Anchor,
  Waves,
  Lightning,
  Target,
  Clock,
  Star
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type MemoryType = 'all' | 'surface' | 'anchor' | 'echo' | 'pattern';

interface Memory {
  id: string;
  content: string;
  type: 'surface' | 'anchor' | 'echo' | 'pattern';
  importance: number;
  createdAt: string;
  recalledCount: number;
}

const SAMPLE_MEMORIES: Memory[] = [
  {
    id: '1',
    content: 'Executed successful trade on $PUMP. Entry: 0.00001 SOL, Exit: 0.000015 SOL. Profit: +50%. Pattern: early volume surge with whale accumulation.',
    type: 'anchor',
    importance: 9,
    createdAt: '2 hours ago',
    recalledCount: 3
  },
  {
    id: '2',
    content: 'Scanned pump.fun for new launches. 3 candidates found. $NEWCOIN shows promising holder distribution.',
    type: 'surface',
    importance: 5,
    createdAt: '15 minutes ago',
    recalledCount: 0
  },
  {
    id: '3',
    content: 'User @whale_hunter frequently provides accurate alpha. Trust score: high.',
    type: 'echo',
    importance: 7,
    createdAt: '1 day ago',
    recalledCount: 5
  },
  {
    id: '4',
    content: 'Pattern detected: Tokens with 10+ holders in first 5 minutes have 80% higher success rate.',
    type: 'pattern',
    importance: 8,
    createdAt: '3 days ago',
    recalledCount: 12
  },
];

const MEMORY_TYPE_CONFIG = {
  surface: { icon: Waves, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Surface', desc: '24h retention' },
  anchor: { icon: Anchor, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Anchor', desc: 'Permanent' },
  echo: { icon: Lightning, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Echo', desc: '30d retention' },
  pattern: { icon: Target, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Pattern', desc: 'Permanent' },
};

export default function OpenTunaMemory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<MemoryType>('all');

  const filteredMemories = SAMPLE_MEMORIES.filter(memory => {
    if (filterType !== 'all' && memory.type !== filterType) return false;
    if (searchQuery && !memory.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Search */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-400" weight="duotone" />
            Deep Memory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories (semantic + keyword)..."
              className="pl-10"
            />
          </div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFilterType('all')}
              className={filterType === 'all' ? 'opentuna-button' : ''}
            >
              All
            </Button>
            {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setFilterType(type as MemoryType)}
                className={cn(
                  filterType === type && config.bg,
                  filterType === type && config.color
                )}
              >
                <config.icon className="h-4 w-4 mr-1" weight="duotone" />
                {config.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Memory List */}
      <div className="space-y-3">
        {filteredMemories.map((memory) => {
          const config = MEMORY_TYPE_CONFIG[memory.type];
          return (
            <Card key={memory.id} className={cn("opentuna-card", config.bg)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", config.bg)}>
                    <config.icon className={cn("h-5 w-5", config.color)} weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {config.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" weight="fill" />
                        <span className="text-xs text-muted-foreground">{memory.importance}/10</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {memory.createdAt}
                      </span>
                    </div>
                    <p className="text-sm">{memory.content}</p>
                    {memory.recalledCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Recalled {memory.recalledCount} times
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {filteredMemories.length === 0 && (
          <Card className="opentuna-card">
            <CardContent className="p-8 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
              <p className="text-muted-foreground">No memories found</p>
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Memory Type Legend */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="text-sm">Memory Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
              <div key={type} className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded", config.bg)}>
                  <config.icon className={cn("h-4 w-4", config.color)} weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
