import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Shield, Target, Zap, Copy, Check, Wallet, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCreateTradingAgent } from "@/hooks/useTradingAgents";

const formSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().max(6).optional(),
  description: z.string().max(500).optional(),
  strategy: z.enum(["conservative", "balanced", "aggressive"]),
  personalityPrompt: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTradingAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const strategies = [
  {
    id: "conservative" as const,
    name: "Conservative",
    icon: Shield,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    hoverBorder: "hover:border-green-500/50",
    stopLoss: "10%",
    takeProfit: "25%",
    positions: "2 max",
    description: "Lower risk, steady gains",
  },
  {
    id: "balanced" as const,
    name: "Balanced",
    icon: Target,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    hoverBorder: "hover:border-amber-500/50",
    stopLoss: "20%",
    takeProfit: "50%",
    positions: "3 max",
    description: "Moderate risk-reward",
  },
  {
    id: "aggressive" as const,
    name: "Aggressive",
    icon: Zap,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    hoverBorder: "hover:border-red-500/50",
    stopLoss: "30%",
    takeProfit: "100%",
    positions: "5 max",
    description: "High risk, high reward",
  },
];

export function CreateTradingAgentModal({ open, onOpenChange }: CreateTradingAgentModalProps) {
  const { toast } = useToast();
  const { solanaAddress, login, isAuthenticated } = useAuth();
  const createAgent = useCreateTradingAgent();
  const [createdAgent, setCreatedAgent] = useState<{
    name: string;
    walletAddress: string;
    ticker: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      strategy: "balanced",
      name: "",
      ticker: "",
      description: "",
      personalityPrompt: "",
    },
  });

  const selectedStrategy = form.watch("strategy");

  const handleCopyAddress = async () => {
    if (createdAgent?.walletAddress) {
      await navigator.clipboard.writeText(createdAgent.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!solanaAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to create a trading agent.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createAgent.mutateAsync({
        name: values.name,
        ticker: values.ticker,
        description: values.description,
        strategy: values.strategy,
        personalityPrompt: values.personalityPrompt,
        creatorWallet: solanaAddress,
      });

      if (result.success) {
        setCreatedAgent({
          name: result.tradingAgent.name,
          walletAddress: result.tradingAgent.walletAddress,
          ticker: result.tradingAgent.ticker,
        });
        toast({
          title: "Trading Agent Created!",
          description: `${result.tradingAgent.name} is ready. Fund the wallet to start trading.`,
        });
      } else {
        throw new Error(result.error || "Failed to create trading agent");
      }
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create trading agent",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setCreatedAgent(null);
    form.reset();
    onOpenChange(false);
  };

  // Success state
  if (createdAgent) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-400" />
              Agent Created Successfully!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold">{createdAgent.name}</h3>
              <Badge variant="outline" className="mt-2">${createdAgent.ticker}</Badge>
            </div>

            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Trading Wallet</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <code className="text-xs break-all text-foreground">
                {createdAgent.walletAddress}
              </code>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-amber-400">Activation Required</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send at least <strong className="text-foreground">0.5 SOL</strong> to the trading wallet address above to activate autonomous trading.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-amber-400" />
            Create Trading Agent
          </DialogTitle>
          <DialogDescription>
            Deploy an autonomous AI agent that trades based on your chosen strategy. 
            <Badge variant="outline" className="ml-2 text-amber-400 border-amber-500/30">BETA</Badge>
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">Connect your wallet to create a trading agent</p>
            <Button onClick={() => login()} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black">
              Connect Wallet
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Strategy Selection */}
              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trading Strategy *</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {strategies.map((strategy) => {
                        const Icon = strategy.icon;
                        const isSelected = field.value === strategy.id;
                        return (
                          <button
                            key={strategy.id}
                            type="button"
                            onClick={() => field.onChange(strategy.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected 
                                ? `${strategy.bgColor} ${strategy.borderColor}` 
                                : `bg-background/50 border-border ${strategy.hoverBorder}`
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className={`h-4 w-4 ${strategy.color}`} />
                              <span className="font-medium text-sm">{strategy.name}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-2">{strategy.description}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0">SL {strategy.stopLoss}</Badge>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">TP {strategy.takeProfit}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="AI generates if empty" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticker (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ALPHA" maxLength={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="AI generates a description if empty" 
                        className="resize-none"
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personalityPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personality Hint (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. 'Analytical and cautious' or 'Bold risk-taker'" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Influences how the agent communicates and makes decisions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAgent.isPending}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600"
                >
                  {createAgent.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Create Agent
                    </>
                  )}
                </Button>
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground text-center">
                By creating a trading agent, you acknowledge that autonomous trading involves risk. 
                You are responsible for funding and managing your agent.
              </p>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
