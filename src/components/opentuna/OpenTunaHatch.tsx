import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Egg,
  ChartLineUp,
  ChatCircle,
  MagnifyingGlass,
  PaintBrush,
  Gear,
  ArrowRight,
  ArrowLeft,
  Check,
  Lightning,
  Wallet,
  CircleNotch
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useCreateOpenTunaAgent } from "@/hooks/useOpenTuna";
import { useOpenTunaContext } from "./OpenTunaContext";
import { usePrivy } from "@privy-io/react-auth";

type AgentType = 'general' | 'trading' | 'social' | 'research' | 'creative';

interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Type" },
  { number: 2, label: "Identity" },
  { number: 3, label: "DNA" },
  { number: 4, label: "Review" },
];

const AGENT_TYPE_OPTIONS = [
  { 
    type: "trading" as AgentType, 
    name: "Trading", 
    icon: ChartLineUp, 
    description: "Autonomous pump.fun trader",
    color: "border-green-500/50 hover:bg-green-500/10"
  },
  { 
    type: "social" as AgentType, 
    name: "Social", 
    icon: ChatCircle, 
    description: "Community manager",
    color: "border-blue-500/50 hover:bg-blue-500/10"
  },
  { 
    type: "research" as AgentType, 
    name: "Research", 
    icon: MagnifyingGlass, 
    description: "Data aggregator",
    color: "border-purple-500/50 hover:bg-purple-500/10"
  },
  { 
    type: "creative" as AgentType, 
    name: "Creative", 
    icon: PaintBrush, 
    description: "Content generator",
    color: "border-pink-500/50 hover:bg-pink-500/10"
  },
  { 
    type: "general" as AgentType, 
    name: "General Purpose", 
    icon: Gear, 
    description: "Full autonomy - do anything",
    color: "border-cyan-500/50 hover:bg-cyan-500/10",
    fullWidth: true
  },
];

interface OpenTunaHatchProps {
  onSuccess?: () => void;
}

export default function OpenTunaHatch({ onSuccess }: OpenTunaHatchProps) {
  const { login, authenticated } = usePrivy();
  const { walletAddress, refetchAgents } = useOpenTunaContext();
  const createAgent = useCreateOpenTunaAgent();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [agentType, setAgentType] = useState<AgentType | null>(null);
  const [agentName, setAgentName] = useState("");
  const [personality, setPersonality] = useState("");
  const [firstGoal, setFirstGoal] = useState("");
  const [isHatching, setIsHatching] = useState(false);

  const canProceed = () => {
    switch (currentStep) {
      case 1: return agentType !== null;
      case 2: return agentName.trim().length > 0;
      case 3: return personality.trim().length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleHatch = async () => {
    if (!walletAddress || !agentType || !agentName || !personality) return;
    
    setIsHatching(true);
    try {
      await createAgent.mutateAsync({
        name: agentName,
        agentType,
        ownerWallet: walletAddress,
        personality,
        firstGoal: firstGoal || undefined,
      });
      
      // Reset form
      setCurrentStep(1);
      setAgentType(null);
      setAgentName("");
      setPersonality("");
      setFirstGoal("");
      
      // Refresh agents list
      refetchAgents();
      
      // Callback
      onSuccess?.();
    } finally {
      setIsHatching(false);
    }
  };

  // Connect wallet prompt
  if (!authenticated || !walletAddress) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Wallet className="h-12 w-12 text-cyan-400 mx-auto mb-4" weight="duotone" />
            <h3 className="text-lg font-semibold mb-2">Connect Wallet to Hatch</h3>
            <p className="text-muted-foreground mb-6">
              Connect your Solana wallet to create an OpenTuna agent
            </p>
            <Button onClick={login} className="opentuna-button">
              <Wallet className="h-4 w-4 mr-2" weight="duotone" />
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <button
              onClick={() => step.number < currentStep && setCurrentStep(step.number)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                currentStep === step.number && "bg-cyan-500 text-white",
                currentStep > step.number && "bg-cyan-500/20 text-cyan-400 cursor-pointer hover:bg-cyan-500/30",
                currentStep < step.number && "bg-secondary text-muted-foreground"
              )}
            >
              {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
            </button>
            <span className={cn(
              "ml-2 text-sm hidden sm:inline",
              currentStep === step.number ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-2",
                currentStep > step.number ? "bg-cyan-500/50" : "bg-secondary"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Egg className="h-5 w-5 text-cyan-400" weight="duotone" />
            {currentStep === 1 && "Choose Agent Type"}
            {currentStep === 2 && "Agent Identity"}
            {currentStep === 3 && "Initial DNA"}
            {currentStep === 4 && "Review & Hatch"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Agent Type */}
          {currentStep === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {AGENT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => setAgentType(option.type)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    option.color,
                    agentType === option.type && "ring-2 ring-cyan-500 border-cyan-500",
                    option.fullWidth && "col-span-2"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <option.icon className="h-6 w-6" weight="duotone" />
                    <div>
                      <p className="font-medium">{option.name}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Identity */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="agentName">Agent Name</Label>
                <Input
                  id="agentName"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., AlphaHunter, SocialBot, ResearchGuru"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a memorable name for your agent
                </p>
              </div>
            </div>
          )}

          {/* Step 3: DNA */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="personality">Personality (DNA Core)</Label>
                <Textarea
                  id="personality"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="A methodical analyst who studies trends before acting. Never FOMOs. Prefers data over hype. Speaks in short, precise sentences."
                  className="mt-1.5 min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Describe your agent's personality, voice, and decision-making style
                </p>
              </div>
              <div>
                <Label htmlFor="firstGoal">First Goal (Optional)</Label>
                <Input
                  id="firstGoal"
                  value={firstGoal}
                  onChange={(e) => setFirstGoal(e.target.value)}
                  placeholder="e.g., Achieve 50% ROI in first week"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Set an initial objective for your agent
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{agentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{agentName}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-muted-foreground text-sm mb-1">Personality</p>
                  <p className="text-sm">{personality}</p>
                </div>
                {firstGoal && (
                  <div className="border-t border-border pt-3">
                    <p className="text-muted-foreground text-sm mb-1">First Goal</p>
                    <p className="text-sm">{firstGoal}</p>
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-sm text-cyan-400">
                  <Lightning className="h-4 w-4 inline mr-1" weight="fill" />
                  Your agent will be created with a new Solana wallet. Fund it to activate.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="opentuna-button"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleHatch}
                disabled={isHatching}
                className="opentuna-button"
              >
                {isHatching ? (
                  <>
                    <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                    Hatching...
                  </>
                ) : (
                  <>
                    <Egg className="h-4 w-4 mr-2" weight="duotone" />
                    Hatch Agent
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
