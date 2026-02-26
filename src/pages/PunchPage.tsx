import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PunchMonkey } from "@/components/punch/PunchMonkey";
import { ComboCounter } from "@/components/punch/ComboCounter";
import { PunchConfetti } from "@/components/punch/PunchConfetti";
import { PunchTokenFeed } from "@/components/punch/PunchTokenFeed";
import { PunchLivestream } from "@/components/punch/PunchLivestream";
import { PunchChatBox } from "@/components/punch/PunchChatBox";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, ExternalLink, ArrowLeft, Loader2, Rocket, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePunchTokenCount } from "@/hooks/usePunchTokenCount";
import { usePunchPageStats } from "@/hooks/usePunchPageStats";
import { useIsMobile } from "@/hooks/use-mobile";

type GameState = "wallet-entry" | "tapping" | "launching" | "result";

const TAPS_TO_WIN = 100;
const DECAY_RATE = 1.2; // % per 100ms when idle — fast decay
const COMBO_WINDOW_MS = 300;
const REQUIRED_TAPS = 100; // must have 100 actual clicks

export default function PunchPage() {
  const { toast } = useToast();
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors, reportPunches } = usePunchPageStats();
  const isMobile = useIsMobile();
  const [showFeed, setShowFeed] = useState(false);
  const [state, setState] = useState<GameState>("wallet-entry");
  const [wallet, setWallet] = useState("");
  const [progress, setProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [tapping, setTapping] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [result, setResult] = useState<{
    mintAddress: string;
    name: string;
    ticker: string;
    imageUrl?: string;
    tokenId?: string;
  } | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const lastTapTime = useRef(0);
  const tapCount = useRef(0);
  const progressRef = useRef(0);
  const decayTimer = useRef<ReturnType<typeof setInterval>>();
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Validate Solana address
  const isValidWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

  const startGame = () => {
    if (!isValidWallet) {
      toast({ title: "Invalid wallet", description: "Enter a valid Solana address", variant: "destructive" });
      return;
    }
    setState("tapping");
    setProgress(0);
    setCombo(0);
    setMultiplier(1);
    tapCount.current = 0;
    progressRef.current = 0;
    lastTapTime.current = 0;
    

    // Start decay timer
    decayTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime.current > 400 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current - DECAY_RATE);
        setProgress(progressRef.current);
      }
    }, 100);
  };

  // Cleanup decay timer
  useEffect(() => {
    return () => {
      if (decayTimer.current) clearInterval(decayTimer.current);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    };
  }, []);

  const handleTap = useCallback(
    (_x: number, _y: number) => {
      if (state !== "tapping") return;
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;
      lastTapTime.current = now;
      tapCount.current++;
      reportPunches(1);

      // Combo logic
      if (timeSinceLastTap < COMBO_WINDOW_MS && timeSinceLastTap > 0) {
        setCombo((c) => c + 1);
        setMultiplier((m) => Math.min(m + 0.1, 3));
      } else {
        setCombo(0);
        setMultiplier(1);
      }

      // Progress increment — base 2%, boosted by multiplier
      const increment = (100 / TAPS_TO_WIN) * Math.min(multiplier, 3);
      progressRef.current = Math.min(100, progressRef.current + increment);
      setProgress(progressRef.current);

      // Screen shake
      setShaking(true);
      setTapping(true);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        setShaking(false);
        setTapping(false);
      }, 80);

      // Win condition
      if (progressRef.current >= 100 && tapCount.current >= REQUIRED_TAPS) {
        if (decayTimer.current) clearInterval(decayTimer.current);
        setShowConfetti(true);
        setTimeout(() => launchToken(), 1500);
      }
    },
    [state, multiplier, reportPunches]
  );

  const launchToken = async () => {
    setState("launching");
    setLaunchError("");
    try {
      const { data, error } = await supabase.functions.invoke("punch-launch", {
        body: { creatorWallet: wallet },
      });

      if (error) throw new Error(error.message || "Launch failed");
      if (data?.error) throw new Error(data.error);
      if (data?.rateLimited) throw new Error(data.error || "Rate limited. Try again later.");

      setResult({
        mintAddress: data.mintAddress,
        name: data.name,
        ticker: data.ticker,
        imageUrl: data.imageUrl,
        tokenId: data.tokenId,
      });
      setState("result");
    } catch (err: any) {
      console.error("[PunchPage] Launch error:", err);
      setLaunchError(err.message || "Something went wrong");
      setState("tapping");
      setProgress(0);
      progressRef.current = 0;
      setShowConfetti(false);
      toast({ title: "Launch failed", description: err.message, variant: "destructive" });
    }
  };

  const copyAddress = () => {
    if (!result?.mintAddress) return;
    navigator.clipboard.writeText(result.mintAddress);
    setCopiedAddress(true);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Progress bar color
  const getBarColor = () => {
    if (progress < 33) return "from-green-500 to-green-400";
    if (progress < 66) return "from-yellow-500 to-yellow-400";
    return "from-orange-500 to-red-500";
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left feed panel - desktop */}
      {!isMobile && (
        <aside className="w-[280px] shrink-0 border-r border-border bg-card/50 h-screen sticky top-0">
          <PunchTokenFeed />
        </aside>
      )}

      {/* Mobile feed toggle */}
      {isMobile && (
        <button
          onClick={() => setShowFeed(!showFeed)}
          className="fixed top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-bold text-foreground shadow-lg"
        >
          {showFeed ? "✕ Close" : "🔥 Feed"}
        </button>
      )}

      {/* Mobile feed overlay */}
      {isMobile && showFeed && (
        <div className="fixed inset-0 z-10 bg-background/95 backdrop-blur-sm animate-fade-in">
          <div className="h-full pt-12">
            <PunchTokenFeed />
          </div>
        </div>
      )}

      {/* Main game content */}
      <div
        className={`flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background ${
          shaking ? "punch-screen-shake" : ""
        }`}
      >
        <PunchConfetti active={showConfetti} />

        {/* Livestream box */}
        <div className="w-full flex justify-center mt-12 mb-2">
          <PunchLivestream />
        </div>

        {/* Chat box - only during wallet entry */}
        {state === "wallet-entry" && (
          <div className="w-full flex justify-center">
            <PunchChatBox />
          </div>
        )}

        {/* Back button */}
        <Link
          to="/"
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* WALLET ENTRY */}
        {state === "wallet-entry" && (
          <div className="max-w-sm w-full space-y-6 animate-fade-in text-center">
            <div className="text-6xl">🐵👊</div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">
              PUNCH TO LAUNCH
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your Solana wallet. Tap fast enough to launch a monkey-themed
              meme coin — image & name auto-generated by AI.
            </p>
            <Input
              placeholder="Your Solana wallet address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value.trim())}
              className="text-center font-mono text-xs"
            />
            <Button
              onClick={startGame}
              disabled={!isValidWallet}
              className="w-full h-12 text-lg font-black btn-gradient-green"
            >
              START PUNCHING
            </Button>
            <p className="text-[10px] text-muted-foreground/60">
              Limited to 1 launch per 3 minutes per IP
            </p>
            {totalLaunched !== null && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono font-bold text-foreground">{totalLaunched.toLocaleString()}</span>
                <span>tokens launched</span>
              </div>
            )}
          </div>
        )}

        {/* TAPPING GAME */}
        {(state === "tapping" || state === "launching") && (
          <div className="flex flex-col items-center gap-6 animate-fade-in w-full max-w-sm">
            <ComboCounter combo={combo} multiplier={multiplier} />

            <div className="text-center">
              <h2 className="text-xl font-black text-foreground">
                {state === "launching" ? "LAUNCHING..." : "TAP THE MONKEY!"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {state === "launching"
                  ? "AI is generating your token..."
                  : "Tap fast to fill the bar — don't stop!"}
              </p>
            </div>

            <PunchMonkey
              onTap={handleTap}
              tapping={tapping}
              completed={state === "launching"}
            />

            {/* Progress bar */}
            <div className="w-full">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-4 rounded-full bg-muted overflow-hidden border border-border">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${getBarColor()} transition-all duration-100`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {state === "launching" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating image & launching on-chain...
              </div>
            )}

            {launchError && (
              <p className="text-xs text-destructive text-center">{launchError}</p>
            )}
          </div>
        )}

        {/* RESULT */}
        {state === "result" && result && (
          <div className="max-w-sm w-full space-y-5 animate-fade-in text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-black text-foreground">TOKEN LAUNCHED!</h2>

            {result.imageUrl && (
              <img
                src={result.imageUrl}
                alt={result.name}
                className="w-32 h-32 rounded-2xl mx-auto border-2 border-border object-cover"
              />
            )}

            <div>
              <p className="text-lg font-bold text-foreground">{result.name}</p>
              <p className="text-sm text-primary font-mono">${result.ticker}</p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary border border-border">
              <code className="text-[11px] font-mono text-foreground/80 flex-1 truncate">
                {result.mintAddress}
              </code>
              <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground">
                {copiedAddress ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link to={`/launchpad/${result.mintAddress}`}>View Token</Link>
              </Button>
              <Button asChild variant="outline" size="icon">
                <a
                  href={`https://solscan.io/token/${result.mintAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setState("wallet-entry");
                setProgress(0);
                setShowConfetti(false);
                setResult(null);
              }}
              className="text-sm"
            >
              Launch Another
            </Button>
          </div>
        )}
        {/* Stats footer */}
        <div className="absolute bottom-0 inset-x-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono font-bold text-foreground">
              {totalPunches !== null ? totalPunches.toLocaleString() : "—"}
            </span>
            <span>punches</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono font-bold text-foreground">
              {uniqueVisitors !== null ? uniqueVisitors.toLocaleString() : "—"}
            </span>
            <span>visitors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
