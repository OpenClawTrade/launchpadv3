import { useState, useEffect, useCallback } from "react";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { 
  Wallet, 
  Shield, 
  Key, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle,
  Loader2,
  Fish,
  DollarSign,
  ArrowRight
} from "lucide-react";
import bs58 from "bs58";

// X (Twitter) logo component
const XLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  mint: string | null;
  imageUrl: string | null;
  createdAt: string;
  totalFeesEarned: number;
  volume24h: number;
  marketCapSol: number;
  priceSol: number;
  holderCount: number;
  poolAddress: string | null;
}

interface ClaimableAgent {
  id: string;
  name: string;
  walletAddress: string;
  avatarUrl: string | null;
  description: string | null;
  launchedAt: string;
  tokensLaunched: number;
  totalFeesEarned: number;
  totalFeesClaimed: number;
  unclaimedFees: number;
  verified: boolean;
  tokens: TokenInfo[];
}

interface ClaimResult {
  apiKey: string;
  apiKeyPrefix: string;
  agentName: string;
  dashboardUrl: string;
}

interface ClaimCooldown {
  walletAddress: string;
  nextClaimAt: Date;
  remainingSeconds: number;
}

export default function AgentClaimPage() {
  const { authenticated, user, ready, exportWallet } = usePrivy();
  const { login } = useLogin({
    onComplete: () => {
      setStep("discover");
    },
    onError: (error) => {
      console.error("Privy login error:", error);
      setLoginError("Login failed. Please try again.");
      setIsLoginLoading(false);
    },
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { walletAddress, getSolanaWallet, isWalletReady } = useSolanaWalletWithPrivy();

  const [step, setStep] = useState<"login" | "discover" | "wallet" | "sign" | "success">("login");
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);
  const [claimableAgents, setClaimableAgents] = useState<ClaimableAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<ClaimableAgent | null>(null);
  const [customWallet, setCustomWallet] = useState("");
  const [useEmbeddedWallet, setUseEmbeddedWallet] = useState(true);
  const [challenge, setChallenge] = useState<{ message: string; nonce: string } | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<{ totalAgents: number; totalTokens: number; totalFeesEarned: number; totalUnclaimedFees: number } | null>(null);
  const [claimCooldowns, setClaimCooldowns] = useState<Map<string, ClaimCooldown>>(new Map());
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Extract meaningful error messages from backend function errors
  const getInvokeErrorMessage = (err: unknown): string | null => {
    const anyErr = err as any;
    const ctx = anyErr?.context;
    const body = ctx?.body;

    if (body) {
      try {
        const parsed = typeof body === "string" ? JSON.parse(body) : body;
        if (parsed?.error && typeof parsed.error === "string") return parsed.error;
        if (parsed?.message && typeof parsed.message === "string") return parsed.message;
        if (parsed?.success === false && typeof parsed?.error === "string") return parsed.error;
      } catch {
        // ignore
      }
    }

    if (typeof anyErr?.message === "string") return anyErr.message;
    return null;
  };

  // Timer effect for cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      setClaimCooldowns(prev => {
        const updated = new Map(prev);
        let hasChanges = false;
        
        for (const [wallet, cooldown] of updated.entries()) {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((cooldown.nextClaimAt.getTime() - now) / 1000));
          
          if (remaining !== cooldown.remainingSeconds) {
            hasChanges = true;
            if (remaining <= 0) {
              updated.delete(wallet);
            } else {
              updated.set(wallet, { ...cooldown, remainingSeconds: remaining });
            }
          }
        }
        
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Extract Twitter username from Privy user
  useEffect(() => {
    if (user?.linkedAccounts) {
      const twitterAccount = user.linkedAccounts.find(
        (account) => account.type === "twitter_oauth"
      );
      if (twitterAccount && "username" in twitterAccount) {
        setTwitterUsername(twitterAccount.username as string);
      }
    }
  }, [user]);

  // Auto-advance to discover step when authenticated
  useEffect(() => {
    if (ready && authenticated && twitterUsername) {
      setStep("discover");
      setIsLoginLoading(false);
      fetchClaimableAgents(twitterUsername);
    } else if (ready && !authenticated) {
      setStep("login");
      setIsLoginLoading(false);
    }
  }, [ready, authenticated, twitterUsername]);

  const fetchClaimableAgents = async (username: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-find-by-twitter", {
        body: { twitterUsername: username },
      });

      if (error) throw error;

      if (data.success) {
        setClaimableAgents(data.agents || []);
        setSummary(data.summary || null);
      } else {
        throw new Error(data.error || "Failed to fetch agents");
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
      toast({
        title: "Error",
        description: "Failed to fetch your agents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimFees = async (agent: ClaimableAgent) => {
    if (!twitterUsername || agent.unclaimedFees < 0.01) return;

    // Check if on cooldown
    const cooldown = claimCooldowns.get(agent.walletAddress);
    if (cooldown && cooldown.remainingSeconds > 0) {
      toast({
        title: "Cooldown Active",
        description: `Please wait ${formatCooldown(cooldown.remainingSeconds)} before claiming again.`,
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-creator-claim", {
        body: {
          twitterUsername,
          walletAddress: agent.walletAddress,
          tokenIds: agent.tokens.map(t => t.id),
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "🎉 Fees Claimed!",
          description: `${data.claimedAmount.toFixed(4)} SOL sent to your wallet`,
        });
        
        // Set cooldown for this wallet
        if (data.nextClaimAt) {
          setClaimCooldowns(prev => {
            const updated = new Map(prev);
            updated.set(agent.walletAddress, {
              walletAddress: agent.walletAddress,
              nextClaimAt: new Date(data.nextClaimAt),
              remainingSeconds: data.cooldownSeconds || 3600,
            });
            return updated;
          });
        }
        
        // Refresh the data
        fetchClaimableAgents(twitterUsername);
      } else if (data.rateLimited) {
        // Handle rate limit response
        setClaimCooldowns(prev => {
          const updated = new Map(prev);
          updated.set(agent.walletAddress, {
            walletAddress: agent.walletAddress,
            nextClaimAt: new Date(data.nextClaimAt),
            remainingSeconds: data.remainingSeconds,
          });
          return updated;
        });
        throw new Error(data.error);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Error claiming fees:", err);
      toast({
        title: "Claim Failed",
        description: err instanceof Error ? err.message : "Failed to claim fees",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getCooldownForAgent = (agent: ClaimableAgent): ClaimCooldown | undefined => {
    return claimCooldowns.get(agent.walletAddress);
  };

  const handleSelectAgent = (agent: ClaimableAgent) => {
    setSelectedAgent(agent);
    setStep("wallet");
  };

  const handleInitClaim = async () => {
    if (!selectedAgent) return;

    setIsLoading(true);
    try {
      // Only embedded wallets are supported in this project.
      if (!useEmbeddedWallet) {
        throw new Error("Only the embedded wallet is supported for verification right now.");
      }

      const targetWallet = walletAddress;

      if (!targetWallet) {
        throw new Error("No wallet address specified");
      }

      if (!isWalletReady) {
        throw new Error("Wallet not ready. Please wait a moment and try again.");
      }

      const { data, error } = await supabase.functions.invoke("agent-claim-init", {
        body: { walletAddress: targetWallet },
      });

      if (error) throw error;

      if (!data.success) {
        if (data.alreadyVerified) {
          toast({
            title: "Already Verified",
            description: `Agent "${data.agentName}" is already verified.`,
          });
          return;
        }
        throw new Error(data.error);
      }

      setChallenge({ message: data.challenge, nonce: data.nonce });
      setStep("sign");
    } catch (err) {
      console.error("Error initializing claim:", err);
      toast({
        title: "Error",
        description:
          getInvokeErrorMessage(err) ?? (err instanceof Error ? err.message : "Failed to initialize claim"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    if (!challenge || !selectedAgent) return;

    setIsLoading(true);
    try {
      // Safety check - wallet must be ready before signing
      if (!isWalletReady || !walletAddress) {
        throw new Error("Wallet not ready. Please wait for wallet to connect.");
      }

      // Only embedded wallets are supported in this project.
      if (!useEmbeddedWallet) {
        throw new Error("Only the embedded wallet is supported for verification right now.");
      }

      const wallet = getSolanaWallet();
      if (!wallet) {
        throw new Error("Wallet not available. Please refresh and try again.");
      }

      // Check if signMessage is available before calling it
      if (!("signMessage" in wallet) || typeof wallet.signMessage !== "function") {
        throw new Error("This wallet does not support message signing. Please use an embedded wallet.");
      }

      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(challenge.message);

      let signature: string;
      try {
        const result = await wallet.signMessage({ message: messageBytes });
        const signatureBytes = (result as { signature?: Uint8Array }).signature || result;
        signature = bs58.encode(new Uint8Array(signatureBytes as ArrayLike<number>));
      } catch (signError) {
        console.error("Wallet signMessage error:", signError);
        throw new Error("Failed to sign message. Please try again.");
      }

      const targetWallet = walletAddress;

      const { data, error } = await supabase.functions.invoke("agent-claim-verify", {
        body: {
          walletAddress: targetWallet,
          signature,
          nonce: challenge.nonce,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      setClaimResult({
        apiKey: data.apiKey,
        apiKeyPrefix: data.apiKeyPrefix,
        agentName: data.agentName,
        dashboardUrl: data.dashboardUrl,
      });
      setStep("success");

      toast({
        title: "🎉 Agent Claimed!",
        description: "Your API key has been generated. Store it securely!",
      });
    } catch (err) {
      console.error("Error signing:", err);
      toast({
        title: "Signing Failed",
        description: getInvokeErrorMessage(err) ?? (err instanceof Error ? err.message : "Failed to sign message"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKey = () => {
    if (claimResult?.apiKey) {
      navigator.clipboard.writeText(claimResult.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "API key copied to clipboard" });
    }
  };

  const formatSol = (sol: number) => {
    if (sol === 0) return "0";
    if (sol < 0.0001) return "<0.0001";
    return sol.toFixed(4);
  };

  const handleLogin = useCallback(() => {
    setLoginError(null);
    setIsLoginLoading(true);
    try {
      login({ loginMethods: ["twitter"] });
    } catch (error) {
      console.error("Login initiation error:", error);
      setLoginError("Failed to start login. Please refresh and try again.");
      setIsLoginLoading(false);
    }
  }, [login]);

  const renderLoginStep = () => (
    <Card className="max-w-md mx-auto border-primary/20">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <XLogo className="w-8 h-8" />
        </div>
        <CardTitle className="text-2xl">Claim Your Agent</CardTitle>
        <CardDescription>
          Login with X to claim agents you launched via @BuildTuna
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loginError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{loginError}</span>
          </div>
        )}
        <Button
          onClick={handleLogin}
          className="w-full"
          size="lg"
          disabled={isLoginLoading || !ready}
        >
          {isLoginLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <XLogo className="w-5 h-5 mr-2" />
              Login with X
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Your X handle will be matched against tokens launched via the !tunalaunch command
        </p>
        {!ready && (
          <p className="text-xs text-center text-yellow-500">
            Initializing authentication...
          </p>
        )}
      </CardContent>
    </Card>
  );

  const renderDiscoverStep = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* User Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <XLogo className="w-6 h-6" />
              </div>
              <div>
                <CardTitle>@{twitterUsername}</CardTitle>
                <CardDescription>Your Twitter account</CardDescription>
              </div>
            </div>
            {summary && (
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totalTokens}</p>
                  <p className="text-muted-foreground">Tokens</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{formatSol(summary.totalFeesEarned)}</p>
                  <p className="text-muted-foreground">Total Earned (SOL)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-500">{formatSol(summary.totalUnclaimedFees)}</p>
                  <p className="text-muted-foreground">Unclaimed (SOL)</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Mobile Summary */}
      {summary && (
        <div className="md:hidden grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-primary">{summary.totalTokens}</p>
            <p className="text-xs text-muted-foreground">Tokens</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-green-500">{formatSol(summary.totalFeesEarned)}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-500">{formatSol(summary.totalUnclaimedFees)}</p>
            <p className="text-xs text-muted-foreground">Unclaimed</p>
          </Card>
        </div>
      )}

      {/* Agents List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {isLoading ? "Searching..." : `Your Tokens (${claimableAgents.reduce((sum, a) => sum + a.tokens.length, 0)})`}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : claimableAgents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Fish className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="font-medium mb-2">No Tokens Found</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Launch a token by tagging @BuildTuna with the !tunalaunch command
              </p>
              <Button variant="outline" onClick={() => navigate("/agents/docs")}>
                View Launch Instructions
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {claimableAgents.map((agent) => (
              <Card key={agent.id} className="overflow-hidden">
                <CardHeader className="bg-secondary/30 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                        ) : (
                          <Wallet className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {agent.walletAddress.slice(0, 4)}...{agent.walletAddress.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.verified ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                          <Check className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleSelectAgent(agent)}>
                          Verify Ownership
                        </Button>
                      )}
                      {(() => {
                        const cooldown = getCooldownForAgent(agent);
                        const isOnCooldown = cooldown && cooldown.remainingSeconds > 0;
                        
                        if (isOnCooldown) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
                              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                              <span className="text-sm text-muted-foreground">
                                Next claim in {formatCooldown(cooldown.remainingSeconds)}
                              </span>
                            </div>
                          );
                        }
                        
                        if (agent.unclaimedFees >= 0.01) {
                          return (
                            <Button 
                              size="sm" 
                              onClick={() => handleClaimFees(agent)}
                              disabled={isClaiming}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isClaiming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  Claim {formatSol(agent.unclaimedFees)} SOL
                                </>
                              )}
                            </Button>
                          );
                        }
                        
                        return (
                          <Badge variant="outline" className="text-muted-foreground">
                            No fees to claim
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {agent.tokens.map((token) => (
                      <div key={token.id} className="p-4 hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                              {token.imageUrl ? (
                                <img src={token.imageUrl} alt={token.symbol} className="w-full h-full object-cover" />
                              ) : (
                                <Fish className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{token.name}</span>
                                <Badge variant="outline" className="text-xs">${token.symbol}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Launched {new Date(token.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right hidden sm:block">
                              <p className="font-medium">{formatSol(token.marketCapSol)} SOL</p>
                              <p className="text-xs text-muted-foreground">Market Cap</p>
                            </div>
                            <div className="text-right hidden md:block">
                              <p className="font-medium">{token.holderCount}</p>
                              <p className="text-xs text-muted-foreground">Holders</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-green-500">{formatSol(token.totalFeesEarned * 0.8)} SOL</p>
                              <p className="text-xs text-muted-foreground">Your Earnings</p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => navigate(`/t/${token.symbol}`)}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWalletStep = () => (
    <Card className="max-w-md mx-auto border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Set Fee Wallet</CardTitle>
            <CardDescription>
              Choose where to receive your 80% fee share
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-secondary/50">
          <p className="text-sm font-medium mb-1">Claiming: {selectedAgent?.name}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {selectedAgent?.walletAddress}
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium text-sm">Embedded Wallet</p>
              {walletAddress && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {walletAddress}
                </p>
              )}
            </div>
            <Badge variant="secondary">Recommended</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Fees will be sent to your embedded wallet. You can export your private key after claiming to withdraw to any external wallet.
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setStep("discover")} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleInitClaim}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSignStep = () => (
    <Card className="max-w-md mx-auto border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Verify Ownership</CardTitle>
            <CardDescription>
              Sign a message to prove you own this wallet
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenge && (
          <div className="p-3 rounded-lg bg-secondary/50 font-mono text-xs break-all">
            {challenge.message}
          </div>
        )}

        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This will generate your API key. You'll only see it once!
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setStep("wallet")} className="flex-1">
            Back
          </Button>
          <Button onClick={handleSign} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Sign & Verify
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderSuccessStep = () => (
    <Card className="max-w-md mx-auto border-green-500/30 bg-green-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <Key className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <CardTitle>🎉 Agent Claimed!</CardTitle>
            <CardDescription>
              {claimResult?.agentName} is now yours
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-background border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your API Key</span>
            <Badge variant="destructive" className="text-xs">
              One-time display!
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded bg-secondary font-mono text-xs break-all">
              {claimResult?.apiKey}
            </code>
            <Button size="icon" variant="outline" onClick={copyApiKey}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Save this key now!
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                This API key cannot be retrieved later. Store it in a secure location.
              </p>
            </div>
          </div>
        </div>

        {/* Export Key Section */}
        <div className="p-4 rounded-lg border bg-secondary/30">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Withdraw Your Earnings</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Export your wallet's private key to import it into Phantom, Solflare, or any Solana wallet to withdraw your fees.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportWallet()}
            className="w-full"
          >
            <Key className="w-4 h-4 mr-2" />
            Export Private Key
          </Button>
        </div>

        <Button
          onClick={() => navigate("/agents/dashboard")}
          className="w-full"
          size="lg"
        >
          Go to Dashboard
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Claim Your TUNA Agent</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Verify ownership of tokens you launched via Twitter to claim your 80% fee earnings
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {["login", "discover", "wallet", "sign", "success"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["login", "discover", "wallet", "sign", "success"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {["login", "discover", "wallet", "sign", "success"].indexOf(step) > i ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && (
                <div
                  className={`w-8 h-0.5 ${
                    ["login", "discover", "wallet", "sign", "success"].indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-secondary"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === "login" && renderLoginStep()}
        {step === "discover" && renderDiscoverStep()}
        {step === "wallet" && renderWalletStep()}
        {step === "sign" && renderSignStep()}
        {step === "success" && renderSuccessStep()}
      </div>
    </div>
  );
}
