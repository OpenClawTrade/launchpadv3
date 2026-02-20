import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dna,
  Plus,
  X,
  Target,
  Warning,
  FloppyDisk,
  Fish,
  Spinner
} from "@phosphor-icons/react";
import { useClawSDKContext } from "./ClawSDKContext";
import { useClawDNA } from "@/hooks/useClawSDK";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Goal {
  id: string;
  goal: string;
  progress: number;
  priority: number;
}

interface ReefLimit {
  id: string;
  limit: string;
}

const SAMPLE_TRAITS = [
  "Analytical", "Patient", "Risk-Averse", "Bold", "Creative", 
  "Methodical", "Aggressive", "Conservative", "Social", "Independent"
];

export default function ClawSDKDNA() {
  const { selectedAgentId, agents } = useClawSDKContext();
  const { data: dna, isLoading } = useClawDNA(selectedAgentId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [personality, setPersonality] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [traitInput, setTraitInput] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reefLimits, setReefLimits] = useState<ReefLimit[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Populate form when DNA data loads
  useEffect(() => {
    if (dna) {
      setPersonality(dna.personality || "");
      setTraits(dna.species_traits || []);
      
      // Parse migration goals
      const parsedGoals = Array.isArray(dna.migration_goals) 
        ? dna.migration_goals.map((g: any, i: number) => ({
            id: crypto.randomUUID(),
            goal: g.goal || g,
            progress: g.progress || 0,
            priority: g.priority || i + 1,
          }))
        : [];
      setGoals(parsedGoals);
      
      // Parse reef limits
      const parsedLimits = (dna.reef_limits || []).map((l: string) => ({
        id: crypto.randomUUID(),
        limit: l,
      }));
      setReefLimits(parsedLimits);
    }
  }, [dna]);

  const addTrait = (trait: string) => {
    if (trait && !traits.includes(trait)) {
      setTraits([...traits, trait]);
      setTraitInput("");
    }
  };

  const removeTrait = (trait: string) => {
    setTraits(traits.filter(t => t !== trait));
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals([...goals, { 
        id: crypto.randomUUID(), 
        goal: newGoal, 
        progress: 0, 
        priority: goals.length + 1 
      }]);
      setNewGoal("");
    }
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const addLimit = () => {
    if (newLimit.trim()) {
      setReefLimits([...reefLimits, { id: crypto.randomUUID(), limit: newLimit }]);
      setNewLimit("");
    }
  };

  const removeLimit = (id: string) => {
    setReefLimits(reefLimits.filter(l => l.id !== id));
  };

  const handleSave = async () => {
    if (!selectedAgentId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('opentuna-dna-update', {
        body: {
          agentId: selectedAgentId,
          personality,
          speciesTraits: traits,
          migrationGoals: goals.map(g => ({
            goal: g.goal,
            progress: g.progress,
            priority: g.priority,
          })),
          reefLimits: reefLimits.map(l => l.limit),
        },
      });

      if (error) throw error;

      toast({
        title: "DNA Saved",
        description: "Agent personality and goals updated successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ['clawsdk-dna', selectedAgentId] });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // No agent selected
  if (!selectedAgentId || agents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="clawsdk-card">
          <CardContent className="p-8 text-center">
            <Fish className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <h3 className="text-lg font-semibold mb-2">No Agents to Configure</h3>
            <p className="text-muted-foreground mb-4">
              Hatch an agent first to configure its DNA
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="clawsdk-card">
          <CardContent className="p-8 text-center">
            <Spinner className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">Loading DNA configuration...</p>
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
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Fish className="h-6 w-6 text-primary" weight="duotone" />
          <div>
            <p className="font-semibold">{selectedAgent.name}</p>
            <p className="text-xs text-muted-foreground">
              DNA v{dna?.version || 1} • {selectedAgent.agent_type}
            </p>
          </div>
        </div>
      )}

      {/* DNA Core */}
      <Card className="clawsdk-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dna className="h-5 w-5 text-primary" weight="duotone" />
            DNA Core (Personality)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="A methodical analyst who studies trends before acting. Never FOMOs. Prefers data over hype. Speaks in short, precise sentences without excessive emojis."
            className="min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This defines your agent's core personality and voice
          </p>
        </CardContent>
      </Card>

      {/* Species Traits */}
      <Card className="clawsdk-card">
        <CardHeader>
          <CardTitle className="text-lg">Species Traits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {traits.map((trait) => (
              <Badge key={trait} variant="secondary" className="gap-1 pr-1">
                {trait}
                <button onClick={() => removeTrait(trait)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={traitInput}
              onChange={(e) => setTraitInput(e.target.value)}
              placeholder="Add trait..."
              onKeyDown={(e) => e.key === 'Enter' && addTrait(traitInput)}
            />
            <Button onClick={() => addTrait(traitInput)} size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SAMPLE_TRAITS.filter(t => !traits.includes(t)).slice(0, 6).map((trait) => (
              <button
                key={trait}
                onClick={() => addTrait(trait)}
                className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
              >
                + {trait}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Migration Goals */}
      <Card className="clawsdk-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-green-400" weight="duotone" />
            Migration Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="p-3 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">{goal.goal}</span>
                <button onClick={() => removeGoal(goal.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={goal.progress} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{goal.progress}%</span>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add a new goal..."
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            />
            <Button onClick={addGoal} size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reef Limits */}
      <Card className="clawsdk-card border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Warning className="h-5 w-5 text-red-400" weight="duotone" />
            Reef Limits (NEVER Violate)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reefLimits.map((limit) => (
            <div key={limit.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-sm">🚫 {limit.limit}</span>
              <button onClick={() => removeLimit(limit.id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder="Add a hard constraint..."
              onKeyDown={(e) => e.key === 'Enter' && addLimit()}
            />
            <Button onClick={addLimit} size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: "Never invest more than 0.1 SOL per trade"
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button 
        className="w-full clawsdk-button" 
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <Spinner className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FloppyDisk className="h-4 w-4 mr-2" weight="duotone" />
        )}
        {isSaving ? "Saving..." : "Save DNA"}
      </Button>
    </div>
  );
}
