import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Download, RefreshCw, Copy, Check, ExternalLink, Lightbulb } from "lucide-react";
import { Rocket } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import tunaLogo from "@/assets/tuna-logo.png";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

interface GeneratedMeme {
  imageUrl: string;
  name: string;
  ticker: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
}

interface LaunchResult {
  mintAddress: string;
  signature: string;
  pumpfunUrl: string;
}

export default function PumpAgentsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [generatedMeme, setGeneratedMeme] = useState<GeneratedMeme | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMeme = async () => {
    setIsGenerating(true);
    setLaunchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("agent-idea-generate", {
        body: { 
          prompt: customPrompt || undefined,
          includeTunaLogo: true 
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to generate");

      setGeneratedMeme({
        imageUrl: data.meme.imageUrl,
        name: data.meme.name,
        ticker: data.meme.ticker,
        description: data.meme.description,
        twitter: "https://x.com/BuildTuna",
        telegram: "",
        website: "",
      });

      toast.success("Meme generated successfully!");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate meme");
    } finally {
      setIsGenerating(false);
    }
  };

  const launchOnPumpFun = async () => {
    if (!generatedMeme) return;
    
    setIsLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("pump-agent-launch", {
        body: {
          name: generatedMeme.name,
          ticker: generatedMeme.ticker,
          description: generatedMeme.description,
          imageUrl: generatedMeme.imageUrl,
          twitter: generatedMeme.twitter,
          telegram: generatedMeme.telegram,
          website: generatedMeme.website,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to launch on pump.fun");

      setLaunchResult({
        mintAddress: data.mintAddress,
        signature: data.signature,
        pumpfunUrl: `https://pump.fun/${data.mintAddress}`,
      });

      toast.success("Token launched on pump.fun!");
    } catch (error: any) {
      console.error("Launch error:", error);
      toast.error(error.message || "Failed to launch on pump.fun");
    } finally {
      setIsLaunching(false);
    }
  };

  const downloadImage = async () => {
    if (!generatedMeme?.imageUrl) return;
    
    try {
      const response = await fetch(generatedMeme.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generatedMeme.ticker || "pump-meme"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const copyCA = () => {
    if (!launchResult?.mintAddress) return;
    navigator.clipboard.writeText(launchResult.mintAddress);
    setCopied(true);
    toast.success("Contract address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="relative">
                <img src={tunaLogo} alt="TUNA" className="w-12 h-12 rounded-full" />
                <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                  <Rocket size={12} weight="fill" className="text-primary-foreground" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                PUMP Agents
              </h2>
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Generate AI memes and launch them on <span className="text-primary font-semibold">pump.fun</span> with one click!
              Your token will also appear in TUNA with its own SubTuna community.
            </p>
          </div>

          {/* Success State */}
          {launchResult && (
            <Card className="p-6 mb-6 bg-primary/10 border-primary/50 animate-in fade-in">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-2">
                  <Rocket size={32} weight="fill" className="text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Launched on pump.fun! 🎉</h3>
                
                <div className="bg-background/50 rounded-lg p-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Contract Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm font-mono text-foreground break-all">
                      {launchResult.mintAddress}
                    </code>
                    <Button
                      onClick={copyCA}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => window.open(launchResult.pumpfunUrl, "_blank")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Trade on pump.fun
                  </Button>
                  <Button
                    onClick={() => window.open(`/t/${generatedMeme?.ticker}`, "_blank")}
                    variant="outline"
                    className="gap-2"
                  >
                    View Community
                  </Button>
                </div>

                <Button
                  onClick={() => {
                    setLaunchResult(null);
                    setGeneratedMeme(null);
                    setCustomPrompt("");
                  }}
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  Launch Another Token
                </Button>
              </div>
            </Card>
          )}

          {/* Input Section */}
          {!launchResult && (
            <Card className="p-6 mb-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt" className="text-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Describe your meme idea (optional)
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder="e.g., 'TUNA astronaut on the moon', 'TUNA wearing sunglasses at a pool party'..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="min-h-[80px] bg-background border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for a random creative concept
                  </p>
                </div>

                <Button
                  onClick={generateMeme}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating Meme...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Meme
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Generated Result */}
          {generatedMeme && !launchResult && (
            <Card className="p-6 bg-card border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image Preview */}
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border">
                    <img
                      src={generatedMeme.imageUrl}
                      alt={generatedMeme.name}
                      className="w-full h-full object-cover"
                    />
                    {/* pump.fun watermark */}
                    <div className="absolute bottom-2 right-2 bg-primary/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                      <Rocket size={14} weight="fill" className="text-primary-foreground" />
                      <span className="text-xs font-bold text-primary-foreground">pump.fun</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={downloadImage}
                      variant="outline"
                      className="flex-1 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      onClick={generateMeme}
                      variant="outline"
                      disabled={isGenerating}
                      className="flex-1 gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Token Details & Launch */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Token Name</Label>
                    <Input
                      value={generatedMeme.name}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, name: e.target.value })}
                      className="mt-1 bg-background border-border font-semibold text-lg"
                      placeholder="Token name"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ticker</Label>
                    <Input
                      value={generatedMeme.ticker}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                      className="mt-1 bg-background border-border font-mono font-bold text-primary"
                      placeholder="TICKER"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
                    <Textarea
                      value={generatedMeme.description}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, description: e.target.value })}
                      className="mt-1 bg-background border-border min-h-[80px]"
                      placeholder="Token description"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">X (Twitter)</Label>
                    <Input
                      value={generatedMeme.twitter}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, twitter: e.target.value })}
                      className="mt-1 bg-background border-border"
                      placeholder="https://x.com/BuildTuna"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Telegram</Label>
                    <Input
                      value={generatedMeme.telegram}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, telegram: e.target.value })}
                      className="mt-1 bg-background border-border"
                      placeholder="https://t.me/yourgroup (optional)"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Website</Label>
                    <Input
                      value={generatedMeme.website}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, website: e.target.value })}
                      className="mt-1 bg-background border-border"
                      placeholder="Auto-set to SubTuna page after launch"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to use the SubTuna community page
                    </p>
                  </div>

                  {/* Launch Button */}
                  <Button
                    onClick={launchOnPumpFun}
                    disabled={isLaunching || !generatedMeme.name || !generatedMeme.ticker}
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-bold text-lg h-14"
                  >
                    {isLaunching ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Launching on pump.fun...
                      </>
                    ) : (
                      <>
                        <Rocket size={20} weight="fill" />
                        Launch on pump.fun
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    pump.fun takes 1% trading fee • Initial 0.01 SOL dev buy included
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Examples Grid */}
          {!generatedMeme && !launchResult && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                Example Meme Concepts
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { prompt: "TUNA astronaut", bg: "from-primary/20 to-cyan-500/20" },
                  { prompt: "Cyber TUNA", bg: "from-primary/20 to-purple-500/20" },
                  { prompt: "King TUNA", bg: "from-primary/20 to-yellow-500/20" },
                  { prompt: "Ninja TUNA", bg: "from-primary/20 to-red-500/20" },
                ].map((example) => (
                  <button
                    key={example.prompt}
                    onClick={() => {
                      setCustomPrompt(example.prompt);
                      toast.info(`Prompt set: "${example.prompt}"`);
                    }}
                    className={`aspect-square rounded-xl bg-gradient-to-br ${example.bg} border border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 p-4`}
                  >
                    <img src={tunaLogo} alt="" className="w-12 h-12 rounded-full" />
                    <span className="text-sm font-medium text-foreground">{example.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
