import { useState, useEffect, useCallback } from "react";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { 
  Twitter, 
  Wallet, 
  Shield, 
  Key, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle,
  Loader2,
  Fish
} from "lucide-react";
import bs58 from "bs58";

interface ClaimableAgent {
  id: string;
  name: string;
  walletAddress: string;
  avatarUrl: string | null;
  description: string | null;
  launchedAt: string;
  tokensLaunched: number;
  tokens: { symbol: string; mint: string; imageUrl: string | null }[];
}

interface ClaimResult {
  apiKey: string;
  apiKeyPrefix: string;
  agentName: string;
  dashboardUrl: string;
}

export default function AgentClaimPage() {
  const { authenticated, user, ready } = usePrivy();
  const { login } = useLogin({
    onComplete: () => {
      setStep("discover");
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
  const [copied, setCopied] = useState(false);

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
      fetchClaimableAgents(twitterUsername);
    } else if (ready && !authenticated) {
      setStep("login");
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

  const handleSelectAgent = (agent: ClaimableAgent) => {
    setSelectedAgent(agent);
    setStep("wallet");
  };

  const handleInitClaim = async () => {
    if (!selectedAgent) return;

    setIsLoading(true);
    try {
      const targetWallet = useEmbeddedWallet ? walletAddress : customWallet;

      if (!targetWallet) {
        throw new Error("No wallet address specified");
      }

      // Validate custom wallet if used
      if (!useEmbeddedWallet && customWallet.length < 32) {
        throw new Error("Invalid wallet address");
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
        description: err instanceof Error ? err.message : "Failed to initialize claim",
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
      const wallet = getSolanaWallet();
      if (!wallet) {
        throw new Error("Wallet not available. Please try again.");
      }

      // Sign the challenge message
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(challenge.message);

      // Use the wallet's signMessage method
      let signature: string;
      if ("signMessage" in wallet && typeof wallet.signMessage === "function") {
        const result = await wallet.signMessage({ message: messageBytes });
        // Handle different return types from Privy wallet
        const signatureBytes = (result as { signature?: Uint8Array }).signature || result;
        signature = bs58.encode(new Uint8Array(signatureBytes as ArrayLike<number>));
      } else {
        throw new Error("Wallet does not support message signing");
      }

      const targetWallet = useEmbeddedWallet ? walletAddress : customWallet;

      // Verify the signature
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
        description: err instanceof Error ? err.message : "Failed to sign message",
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

  const renderLoginStep = () => (
    <Card className="max-w-md mx-auto border-primary/20">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Twitter className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Claim Your Agent</CardTitle>
        <CardDescription>
          Login with Twitter to claim agents you launched via @TunaLaunch
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => login({ loginMethods: ["twitter"] })}
          className="w-full"
          size="lg"
        >
          <Twitter className="w-5 h-5 mr-2" />
          Login with Twitter
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Your Twitter handle will be matched against agents launched via the !tunalaunch command
        </p>
      </CardContent>
    </Card>
  );

  const renderDiscoverStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Twitter className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>@{twitterUsername}</CardTitle>
              <CardDescription>Your Twitter account</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {isLoading ? "Searching..." : `Claimable Agents (${claimableAgents.length})`}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : claimableAgents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Fish className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="font-medium mb-2">No Unclaimed Agents Found</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Launch a token by tweeting @TunaLaunch with the !tunalaunch command
              </p>
              <Button variant="outline" onClick={() => navigate("/agents/docs")}>
                View Launch Instructions
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {claimableAgents.map((agent) => (
              <Card
                key={agent.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectAgent(agent)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Fish className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{agent.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {agent.tokensLaunched} tokens launched
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.tokens.slice(0, 3).map((token, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          ${token.symbol}
                        </Badge>
                      ))}
                      <Button size="sm">Claim</Button>
                    </div>
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

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-secondary/30 transition-colors">
            <input
              type="radio"
              checked={useEmbeddedWallet}
              onChange={() => setUseEmbeddedWallet(true)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">Use Embedded Wallet</p>
              {walletAddress && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {walletAddress}
                </p>
              )}
            </div>
            <Badge variant="secondary">Recommended</Badge>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-secondary/30 transition-colors">
            <input
              type="radio"
              checked={!useEmbeddedWallet}
              onChange={() => setUseEmbeddedWallet(false)}
              className="w-4 h-4 mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">Use External Wallet</p>
              {!useEmbeddedWallet && (
                <Input
                  placeholder="Enter Solana wallet address"
                  value={customWallet}
                  onChange={(e) => setCustomWallet(e.target.value)}
                  className="mt-2"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setStep("discover")} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleInitClaim}
            disabled={isLoading || (!useEmbeddedWallet && !customWallet)}
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
            Verify ownership of agents you launched via Twitter to access your dashboard and API key
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
