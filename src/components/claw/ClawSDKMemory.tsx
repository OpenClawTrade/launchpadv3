import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Brain,
  MagnifyingGlass,
  Anchor,
  Waves,
  Lightning,
  Target,
  Clock,
  Star,
  Plus,
  Fish,
  Spinner
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useOpenTunaContext } from "./OpenTunaContext";
import { useOpenTunaMemories } from "@/hooks/useOpenTuna";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MemoryType = 'all' | 'surface' | 'anchor' | 'echo' | 'pattern';

const MEMORY_TYPE_CONFIG = {
  surface: { icon: Waves, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Surface', desc: '24h retention' },
  anchor: { icon: Anchor, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Anchor', desc: 'Permanent' },
  echo: { icon: Lightning, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Echo', desc: '30d retention' },
  pattern: { icon: Target, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Pattern', desc: 'Permanent' },
};

export default function OpenTunaMemory() {
  const { selectedAgentId, agents } = useOpenTunaContext();
  const [filterType, setFilterType] = useState<MemoryType>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  
  const { data: memories, isLoading } = useOpenTunaMemories(
    selectedAgentId, 
    filterType === 'all' ? undefined : filterType,
    50
  );
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add memory dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMemory, setNewMemory] = useState({
    content: '',
    type: 'surface' as 'surface' | 'anchor' | 'echo' | 'pattern',
    importance: 5,
    tags: '',
  });
  const [isAdding, setIsAdding] = useState(false);

  const handleSearch = async () => {
    if (!selectedAgentId || !searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('opentuna-echo-locate', {
        body: {
          agentId: selectedAgentId,
          query: searchQuery,
          limit: 10,
          memoryTypes: filterType === 'all' ? undefined : [filterType],
        },
      });

      if (error) throw error;
      setSearchResults(data.results || []);
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMemory = async () => {
    if (!selectedAgentId || !newMemory.content.trim()) return;
    
    setIsAdding(true);
    try {
      const { error } = await supabase.functions.invoke('opentuna-memory-store', {
        body: {
          agentId: selectedAgentId,
          content: newMemory.content,
          memoryType: newMemory.type,
          importance: newMemory.importance,
          tags: newMemory.tags.split(',').map(t => t.trim()).filter(Boolean),
        },
      });

      if (error) throw error;

      toast({
        title: "Memory Stored",
        description: `${MEMORY_TYPE_CONFIG[newMemory.type].label} memory added successfully.`,
      });

      setNewMemory({ content: '', type: 'surface', importance: 5, tags: '' });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['opentuna-memories', selectedAgentId] });
    } catch (error: any) {
      toast({
        title: "Store Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // No agent selected
  if (!selectedAgentId || agents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Fish className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <h3 className="text-lg font-semibold mb-2">No Agents Available</h3>
            <p className="text-muted-foreground">Hatch an agent first to explore its memories</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayMemories = searchResults || memories || [];
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Agent Info */}
      {selectedAgent && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" weight="duotone" />
            <div>
              <p className="font-semibold">{selectedAgent.name}</p>
              <p className="text-xs text-muted-foreground">
                {memories?.length || 0} memories stored
              </p>
            </div>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="opentuna-button">
                <Plus className="h-4 w-4 mr-1" />
                Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Store New Memory</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Textarea
                    value={newMemory.content}
                    onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                    placeholder="Memory content..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Type</label>
                    <Select 
                      value={newMemory.type} 
                      onValueChange={(v) => setNewMemory({ ...newMemory, type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
                          <SelectItem key={type} value={type}>
                            <span className="flex items-center gap-2">
                              <config.icon className={cn("h-4 w-4", config.color)} />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Importance (1-10)</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={newMemory.importance}
                      onChange={(e) => setNewMemory({ ...newMemory, importance: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Tags (comma-separated)</label>
                  <Input
                    value={newMemory.tags}
                    onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
                    placeholder="trade, analysis, important"
                  />
                </div>
                <Button 
                  className="w-full opentuna-button" 
                  onClick={handleAddMemory}
                  disabled={isAdding || !newMemory.content.trim()}
                >
                  {isAdding ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : null}
                  Store Memory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Search */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" weight="duotone" />
            Deep Memory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories (semantic + keyword)..."
                className="pl-10"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchQuery.trim()}
              className="opentuna-button"
            >
              {isSearching ? <Spinner className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
            {searchResults && (
              <Button variant="ghost" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => { setFilterType('all'); setSearchResults(null); }}
              className={filterType === 'all' ? 'opentuna-button' : ''}
            >
              All
            </Button>
            {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'secondary'}
                size="sm"
                onClick={() => { setFilterType(type as MemoryType); setSearchResults(null); }}
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

          {searchResults && (
            <p className="text-sm text-muted-foreground">
              Found {searchResults.length} memories matching "{searchQuery}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Memory List */}
      {isLoading ? (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Spinner className="h-8 w-8 text-primary mx-auto animate-spin" />
            <p className="text-muted-foreground mt-2">Loading memories...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayMemories.map((memory: any) => {
            const memType = memory.memory_type || memory.memoryType;
            const config = MEMORY_TYPE_CONFIG[memType as keyof typeof MEMORY_TYPE_CONFIG];
            if (!config) return null;
            
            return (
              <Card key={memory.id} className={cn("opentuna-card", config.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg", config.bg)}>
                      <config.icon className={cn("h-5 w-5", config.color)} weight="duotone" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" weight="fill" />
                          <span className="text-xs text-muted-foreground">{memory.importance}/10</span>
                        </div>
                        {memory.relevanceScore !== undefined && (
                          <span className="text-xs text-primary">
                            Score: {memory.relevanceScore.toFixed(2)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(memory.created_at || memory.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{memory.content}</p>
                      {(memory.tags?.length > 0 || memory.recalled_count > 0 || memory.recalledCount > 0) && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {memory.tags?.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                          {(memory.recalled_count > 0 || memory.recalledCount > 0) && (
                            <span className="text-xs text-muted-foreground">
                              Recalled {memory.recalled_count || memory.recalledCount} times
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {displayMemories.length === 0 && (
            <Card className="opentuna-card">
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
                <p className="text-muted-foreground">No memories found</p>
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearSearch}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
