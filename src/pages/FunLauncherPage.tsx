import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shuffle, Rocket, ArrowLeft, Sparkles, Coins, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

interface MemeToken {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
}

export default function FunLauncherPage() {
  const { toast } = useToast();
  const [meme, setMeme] = useState<MemeToken | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Validate Solana wallet address
  const isValidSolanaAddress = (address: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  // Generate a new meme token using AI
  const handleRandomize = useCallback(async () => {
    setIsGenerating(true);
    setMeme(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", {
        body: {}
      });

      if (error) throw error;

      if (data?.meme) {
        setMeme(data.meme);
        toast({
          title: "Meme Generated! 🎲",
          description: `${data.meme.name} ($${data.meme.ticker}) is ready!`,
        });
      }
    } catch (error) {
      console.error("Generate error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate meme",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  // Launch the token
  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({
        title: "No meme to launch",
        description: "Click Randomize first to generate a meme token",
        variant: "destructive",
      });
      return;
    }

    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({
        title: "Invalid wallet address",
        description: "Please enter a valid Solana wallet address to receive fee rewards",
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);

    try {
      const { data, error } = await supabase.functions.invoke("fun-create", {
        body: {
          name: meme.name,
          ticker: meme.ticker,
          description: meme.description,
          imageUrl: meme.imageUrl,
          creatorWallet: walletAddress,
        }
      });

      if (error) throw error;

      toast({
        title: "Token Launched! 🚀",
        description: `${meme.name} is now live! You'll receive 50% of trading fees every 6 hours.`,
      });

      // Reset state for next launch
      setMeme(null);
      setWalletAddress("");
    } catch (error) {
      console.error("Launch error:", error);
      toast({
        title: "Launch failed",
        description: error instanceof Error ? error.message : "Failed to launch token",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  }, [meme, walletAddress, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container max-w-4xl mx-auto flex items-center gap-4 px-4 h-16">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">FUN LAUNCHER</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            One-Click Meme Coins
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI generates a random meme token for you. Launch it instantly and earn 50% of all trading fees!
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Coins className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">50%</p>
              <p className="text-sm text-muted-foreground">Fee Share</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 text-center">
              <Rocket className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">FREE</p>
              <p className="text-sm text-muted-foreground">To Launch</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Wallet className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">6h</p>
              <p className="text-sm text-muted-foreground">Payouts</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card className="border-2 border-dashed border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Your Random Meme Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview Area */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {/* Image Preview */}
              <div className="w-48 h-48 rounded-full overflow-hidden bg-muted flex-shrink-0 border-4 border-primary/20">
                {isGenerating ? (
                  <Skeleton className="w-full h-full rounded-full" />
                ) : meme?.imageUrl ? (
                  <img 
                    src={meme.imageUrl} 
                    alt={meme.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Shuffle className="h-12 w-12" />
                  </div>
                )}
              </div>

              {/* Token Details */}
              <div className="flex-1 space-y-3 text-center md:text-left">
                {isGenerating ? (
                  <>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-20 w-full" />
                  </>
                ) : meme ? (
                  <>
                    <h3 className="text-2xl font-bold">{meme.name}</h3>
                    <p className="text-lg text-primary font-mono">${meme.ticker}</p>
                    <p className="text-muted-foreground">{meme.description}</p>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    <p className="text-lg">Click "Randomize" to generate a unique meme token!</p>
                    <p className="text-sm mt-2">AI will create a name, ticker, description, and logo for you.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Randomize Button */}
            <Button
              onClick={handleRandomize}
              disabled={isGenerating || isLaunching}
              size="lg"
              variant="outline"
              className="w-full h-14 text-lg"
            >
              {isGenerating ? (
                <>
                  <Shuffle className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shuffle className="h-5 w-5 mr-2" />
                  Randomize
                </>
              )}
            </Button>

            {/* Wallet Input & Launch */}
            {meme && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Your Solana Wallet Address
                  </label>
                  <Input
                    placeholder="Enter your Solana wallet to receive fee rewards..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="h-12 text-base font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll receive 50% of all trading fees to this wallet every 6 hours
                  </p>
                </div>

                <Button
                  onClick={handleLaunch}
                  disabled={isLaunching || !walletAddress}
                  size="lg"
                  className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  {isLaunching ? (
                    <>
                      <Rocket className="h-5 w-5 mr-2 animate-bounce" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-5 w-5 mr-2" />
                      Launch Token
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <span>Click <strong>Randomize</strong> - AI generates a unique meme token with name, ticker, description, and logo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <span>Enter your Solana wallet address to receive fee rewards</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <span>Click <strong>Launch</strong> - Token is created instantly (no fees for you!)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                <span>Earn <strong>50% of all trading fees</strong> paid directly to your wallet every 6 hours</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
