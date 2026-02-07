import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  ShieldCheck,
  Sparkle,
  Spinner
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OpenTunaAgentSelector from "./OpenTunaAgentSelector";

interface Fin {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  is_native: boolean;
  is_verified: boolean;
  cost_sol: number;
  total_uses: number;
  success_rate: number;
  provider_agent_id?: string;
}

interface InstalledFin {
  fin_id: string;
  times_used: number;
  enabled: boolean;
  fin: Fin;
}

const FIN_ICONS: Record<string, React.ElementType> = {
  fin_read: File,
  fin_write: PencilSimple,
  fin_edit: PencilSimple,
  fin_bash: Terminal,
  fin_browse: Globe,
  fin_trade: ChartLineUp,
  fin_post: ChatCircle,
  fin_memory_store: Brain,
  fin_memory_recall: Brain,
  fin_ai: Lightning,
  default: PuzzlePiece,
};

const CATEGORIES = ['all', 'core', 'trading', 'social', 'research', 'creative', 'development'];

export default function OpenTunaFins() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [installedFins, setInstalledFins] = useState<InstalledFin[]>([]);
  const [marketFins, setMarketFins] = useState<Fin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [forging, setForging] = useState(false);
  const [forgeDialogOpen, setForgeDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedAgentId) {
      fetchFins();
    }
  }, [selectedAgentId]);

  const fetchFins = async () => {
    if (!selectedAgentId) return;
    
    setLoading(true);
    try {
      // Fetch installed fins
      const { data: rack, error: rackError } = await supabase
        .from("opentuna_fin_rack")
        .select(`
          fin_id,
          times_used,
          enabled,
          opentuna_fins!inner(*)
        `)
        .eq("agent_id", selectedAgentId);

      if (!rackError && rack) {
        setInstalledFins(rack.map(r => ({
          fin_id: r.fin_id,
          times_used: r.times_used || 0,
          enabled: r.enabled,
          fin: r.opentuna_fins as unknown as Fin,
        })));
      }

      // Fetch all market fins (not already installed)
      const installedIds = rack?.map(r => r.fin_id) || [];
      
      const { data: fins, error: finsError } = await supabase
        .from("opentuna_fins")
        .select("*")
        .not("id", "in", `(${installedIds.length > 0 ? installedIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);

      if (!finsError && fins) {
        setMarketFins(fins as Fin[]);
      }
    } catch (error) {
      console.error("Failed to fetch fins:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (finId: string) => {
    if (!selectedAgentId) return;
    
    setInstalling(finId);
    try {
      const { error } = await supabase
        .from("opentuna_fin_rack")
        .insert({
          agent_id: selectedAgentId,
          fin_id: finId,
          enabled: true,
        });

      if (error) throw error;

      toast({
        title: "Fin Installed",
        description: "The fin has been added to your rack",
      });

      fetchFins();
    } catch (error: any) {
      toast({
        title: "Installation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleForge = async () => {
    if (!selectedAgentId) return;
    
    setForging(true);
    try {
      const { data, error } = await supabase.functions.invoke("opentuna-fin-forge", {
        body: { agentId: selectedAgentId },
      });

      if (error) throw error;

      toast({
        title: "Fin Forge Complete",
        description: data.message || `Detected ${data.patternsDetected} patterns`,
      });

      if (data.forgedFins?.length > 0) {
        fetchFins();
      }

      setForgeDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Forge Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setForging(false);
    }
  };

  const getFinIcon = (finName: string) => {
    return FIN_ICONS[finName] || FIN_ICONS.default;
  };

  const filterFins = (fins: Fin[]) => {
    if (category === 'all') return fins;
    return fins.filter(f => f.category === category);
  };

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <OpenTunaAgentSelector 
        selectedAgentId={selectedAgentId}
        onSelect={setSelectedAgentId}
      />

      {!selectedAgentId ? (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <PuzzlePiece className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <p className="text-muted-foreground">Select an agent to manage their Fin Rack</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Spinner className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">Loading fins...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* My Fin Rack */}
          <Card className="opentuna-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PuzzlePiece className="h-5 w-5 text-primary" weight="duotone" />
                My Fin Rack ({installedFins.length} installed)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {installedFins.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No fins installed yet</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {installedFins.map((item) => {
                    const Icon = getFinIcon(item.fin.name);
                    return (
                      <div 
                        key={item.fin_id}
                        className={cn(
                          "p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all",
                          !item.enabled && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-primary" weight="duotone" />
                          <span className="text-sm font-medium truncate">{item.fin.display_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {item.fin.is_native ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Native
                              </>
                            ) : (
                              <>{Number(item.fin.cost_sol).toFixed(3)} SOL</>
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{item.times_used} uses</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                {filterFins(marketFins).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No fins available in this category
                  </p>
                ) : (
                  filterFins(marketFins).map((fin) => {
                    const Icon = getFinIcon(fin.name);
                    return (
                      <div 
                        key={fin.id}
                      className="p-4 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" weight="duotone" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{fin.display_name}</h4>
                              {fin.is_verified && (
                                  <ShieldCheck className="h-4 w-4 text-green-400" weight="fill" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{fin.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-400" weight="fill" />
                                  {Number(fin.success_rate || 0).toFixed(1)}% success
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {(fin.total_uses || 0).toLocaleString()} uses
                                </span>
                              </div>
                            </div>
                          </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {fin.is_native ? "Free" : `${Number(fin.cost_sol || 0).toFixed(3)} SOL`}
                          </p>
                            <Button 
                              size="sm" 
                              className="mt-2 opentuna-button"
                              onClick={() => handleInstall(fin.id)}
                              disabled={installing === fin.id}
                            >
                              {installing === fin.id ? (
                                <Spinner className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-1" />
                              )}
                              Install
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fin Forge */}
          <Card className="opentuna-card border-dashed">
            <CardContent className="p-6 text-center">
              <Sparkle className="h-10 w-10 text-primary mx-auto mb-3" weight="duotone" />
              <h3 className="font-semibold mb-2">Fin Forge</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Analyze your agent's usage patterns and auto-generate new fins based on repeated successful sequences
              </p>
              <Dialog open={forgeDialogOpen} onOpenChange={setForgeDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="opentuna-button">
                    <Sparkle className="h-4 w-4 mr-2" />
                    Run Fin Forge
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Fin Forge - Pattern Detection</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Fin Forge will analyze your agent's execution history to detect repeated patterns.
                      If a sequence is used 5+ times with 80%+ success rate, it can be forged into a new reusable fin.
                    </p>
                    <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Min occurrences:</span>
                        <span className="font-mono">5</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Min success rate:</span>
                        <span className="font-mono">80%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max auto-forge:</span>
                        <span className="font-mono">3 fins</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full opentuna-button"
                      onClick={handleForge}
                      disabled={forging}
                    >
                      {forging ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing patterns...
                        </>
                      ) : (
                        <>
                          <Sparkle className="h-4 w-4 mr-2" />
                          Start Forge
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
