import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type GameState = "tapping" | "launching" | "result";

const STEPS = 18;
const TAPS_TO_WIN = 100;
const DECAY_RATE = 1.2;
const COMBO_WINDOW_MS = 300;
const REQUIRED_TAPS = 100;

export default function PunchTestPage() {
  const { toast } = useToast();
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors, reportPunches } = usePunchPageStats();
  const isMobile = useIsMobile();

  // Game state
  const [state, setState] = useState<GameState>("tapping");
  const [progress, setProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [tapping, setTapping] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [wallet, setWallet] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [result, setResult] = useState<{
    mintAddress: string;
    name: string;
    ticker: string;
    imageUrl?: string;
    tokenId?: string;
  } | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Branch animation state — maps progress to visual steps
  const step = Math.round((progress / 100) * STEPS);
  const won = state === "launching" || state === "result";

  // Responsive move amounts
  const getMovePx = () => Math.max(4, Math.min(10, window.innerWidth / 100));
  const getMoveY = () => Math.max(1.5, Math.min(3, window.innerWidth / 200));

  const lastTapTime = useRef(0);
  const tapCount = useRef(0);
  const progressRef = useRef(0);
  const decayTimer = useRef<ReturnType<typeof setInterval>>();
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isValidWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

  // Start decay timer
  useEffect(() => {
    decayTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime.current > 400 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current - DECAY_RATE);
        setProgress(progressRef.current);
      }
    }, 100);
    return () => {
      if (decayTimer.current) clearInterval(decayTimer.current);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    };
  }, []);

  const handleTap = useCallback(() => {
    if (state !== "tapping") return;
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    lastTapTime.current = now;
    tapCount.current++;
    reportPunches(1);

    // Show wallet prompt after 30 taps
    if (tapCount.current >= 30 && !isValidWallet) {
      setShowWalletPrompt(true);
    }

    // Combo logic
    if (timeSinceLastTap < COMBO_WINDOW_MS && timeSinceLastTap > 0) {
      setCombo((c) => c + 1);
      setMultiplier((m) => Math.min(m + 0.1, 3));
    } else {
      setCombo(0);
      setMultiplier(1);
    }

    // Progress increment
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
      if (!isValidWallet) {
        setShowWalletPrompt(true);
        progressRef.current = 99;
        setProgress(99);
        return;
      }
      if (decayTimer.current) clearInterval(decayTimer.current);
      setShowConfetti(true);
      setTimeout(() => launchToken(), 1500);
    }
  }, [state, multiplier, reportPunches, isValidWallet]);

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
      console.error("[PunchTestPage] Launch error:", err);
      setLaunchError(err.message || "Something went wrong");
      setState("tapping");
      setProgress(0);
      progressRef.current = 0;
      setShowConfetti(false);
      toast({ title: "Launch failed", description: err.message, variant: "destructive" });
    }
  };

  const resetGame = () => {
    setState("tapping");
    setProgress(0);
    setShowConfetti(false);
    setResult(null);
    tapCount.current = 0;
    progressRef.current = 0;
    setShowWalletPrompt(false);
    decayTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime.current > 400 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current - DECAY_RATE);
        setProgress(progressRef.current);
      }
    }, 100);
  };

  const copyAddress = () => {
    if (!result?.mintAddress) return;
    navigator.clipboard.writeText(result.mintAddress);
    setCopiedAddress(true);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const getBarColor = () => {
    if (progress < 33) return "from-green-500 to-green-400";
    if (progress < 66) return "from-yellow-500 to-yellow-400";
    return "from-orange-500 to-red-500";
  };

  const movePx = getMovePx();
  const moveY = getMoveY();

  return (
    <div className="min-h-screen flex w-full bg-black">
      {/* Left feed panel — desktop */}
      {!isMobile && (
        <aside className="w-[280px] shrink-0 border-r border-white/10 bg-black/80 h-screen sticky top-0">
          <PunchTokenFeed />
        </aside>
      )}

      {/* Mobile feed toggle */}
      {isMobile && (
        <button
          onClick={() => setShowFeed(!showFeed)}
          className="fixed top-4 right-4 z-[100001] px-3 py-1.5 rounded-full bg-neutral-900 border border-white/20 text-xs font-bold text-white shadow-lg"
        >
          {showFeed ? "✕ Close" : "🔥 Feed"}
        </button>
      )}

      {/* Mobile feed overlay */}
      {isMobile && showFeed && (
        <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-sm animate-fade-in">
          <div className="h-full pt-12">
            <PunchTokenFeed />
          </div>
        </div>
      )}

      <PunchConfetti active={showConfetti} />

      {/* Main game area */}
      <div
        className={`flex-1 relative overflow-hidden ${shaking ? "punch-screen-shake" : ""}`}
        style={{ background: "#000" }}
      >
        {/* Back button */}
        <Link
          to="/"
          className="absolute top-4 left-4 z-[100001] flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* ========== TAPPING / LAUNCHING STATE ========== */}
        {(state === "tapping" || state === "launching") && (
          <div
            onClick={(e) => {
              // Don't count clicks on inputs/buttons
              if ((e.target as HTMLElement).closest("input, button, a")) return;
              handleTap();
            }}
            style={{
              position: "relative",
              width: "100%",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: state === "launching" ? "default" : "pointer",
              userSelect: "none",
            }}
          >
            <ComboCounter combo={combo} multiplier={multiplier} />

            {/* Title */}
            <div className="text-center mb-4 z-10">
              <h2 className="text-xl font-black text-white">
                {state === "launching" ? "LAUNCHING..." : "PUNCH A BRANCH TO LAUNCH"}
              </h2>
              <p className="text-xs text-white/50 mt-1">
                {state === "launching"
                  ? "AI is generating your token..."
                  : "Tap fast to fill the bar — don't stop!"}
              </p>
            </div>

            {/* ===== BRANCH ANIMATION ===== */}
            <div
              style={{
                position: "relative",
                width: "min(72vw, 720px)",
                marginTop: "-8vh",
                transform: "rotate(-7deg)",
                zIndex: 4,
                opacity: state === "launching" ? 0 : 1,
                transition: "opacity 600ms ease-in-out",
                pointerEvents: state === "launching" ? "none" : undefined,
              }}
            >
              <img
                src="/branch.png"
                alt="branch"
                draggable={false}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.08))",
                  pointerEvents: "none",
                }}
              />
              <img
                src="/toy.png"
                alt="toy"
                draggable={false}
                style={{
                  position: "absolute",
                  left: "18%",
                  top: "23%",
                  width: "50%",
                  height: "auto",
                  zIndex: 6,
                  pointerEvents: "none",
                  transition: "transform 100ms ease-out",
                  transform: `translate(${step * movePx}px, ${step * moveY}px) rotate(5deg)`,
                  filter: "drop-shadow(0 6px 12px rgba(255,255,255,0.1))",
                }}
              />
            </div>

            {/* Baby monkey */}
            <img
              src="/monkey.png"
              alt="Monkey"
              draggable={false}
              style={{
                position: "absolute",
                width: "min(30vw, 420px)",
                height: "auto",
                zIndex: 2,
                filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.1))",
                right: "calc(50% - 33vw)",
                bottom: "calc(50% - 28vw)",
                opacity: state === "launching" ? 0 : 1,
                transition: "opacity 600ms ease-in-out",
                pointerEvents: "none",
              }}
            />

            {/* Final hug image — shown during launching transition */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                zIndex: 10,
                opacity: state === "launching" ? 1 : 0,
                transition: "opacity 600ms ease-in-out",
                pointerEvents: state === "launching" ? undefined : "none",
              }}
            >
              <img
                src="/final.png"
                alt="Victory"
                draggable={false}
                style={{
                  maxWidth: "90vw",
                  maxHeight: "70vh",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </div>

            {/* UI overlay at bottom */}
            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 space-y-3 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Wallet prompt after 30 taps */}
              {showWalletPrompt && !isValidWallet && state === "tapping" && (
                <div className="w-full p-3 rounded-xl border border-yellow-500/50 bg-yellow-500/10 animate-fade-in space-y-2">
                  <p className="text-xs font-bold text-white text-center">
                    🐵 Enter your Solana address so we know where to send fees when your token launches!
                  </p>
                  <Input
                    placeholder="Your Solana wallet address"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value.trim())}
                    className="text-center font-mono text-xs bg-black/50 border-white/20 text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* Wallet input — subtle when not prompted */}
              {!showWalletPrompt && state === "tapping" && (
                <Input
                  placeholder="Solana wallet (optional for now)"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  className="text-center font-mono text-[10px] opacity-40 focus:opacity-100 transition-opacity bg-black/50 border-white/20 text-white"
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              {/* Progress bar */}
              <div className="w-full">
                <div className="flex justify-between text-[10px] font-mono text-white/50 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-4 rounded-full bg-white/10 overflow-hidden border border-white/20">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getBarColor()} transition-all duration-100`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {state === "launching" && (
                <div className="flex items-center justify-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating image & launching on-chain...
                </div>
              )}

              {launchError && (
                <p className="text-xs text-red-400 text-center">{launchError}</p>
              )}

              {totalLaunched !== null && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-white/50">
                  <Rocket className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="font-mono font-bold text-white">{totalLaunched.toLocaleString()}</span>
                  <span>tokens launched</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== RESULT STATE ========== */}
        {state === "result" && result && (
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="max-w-sm w-full space-y-5 animate-fade-in text-center">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-black text-white">TOKEN LAUNCHED!</h2>

              {result.imageUrl && (
                <img
                  src={result.imageUrl}
                  alt={result.name}
                  className="w-32 h-32 rounded-2xl mx-auto border-2 border-white/20 object-cover"
                />
              )}

              <div>
                <p className="text-lg font-bold text-white">{result.name}</p>
                <p className="text-sm text-yellow-400 font-mono">${result.ticker}</p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <code className="text-[11px] font-mono text-white/80 flex-1 truncate">
                  {result.mintAddress}
                </code>
                <button onClick={copyAddress} className="text-white/50 hover:text-white">
                  {copiedAddress ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
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

              <Button variant="ghost" onClick={resetGame} className="text-sm text-white/60">
                Launch Another
              </Button>
            </div>
          </div>
        )}

        {/* Livestream + Chat — fixed bottom area, only during tapping */}
        {(state === "tapping" || state === "launching") && (
          <div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-4 z-30 space-y-2"
            style={{ pointerEvents: "auto" }}
          >
            <PunchLivestream />
            <PunchChatBox />
            <p className="text-[10px] text-white/30 text-center">
              Limited to 1 launch per 3 minutes per IP
            </p>
          </div>
        )}

        {/* Stats footer */}
        <div className="absolute bottom-0 inset-x-0 border-t border-white/10 bg-black/80 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-6 text-xs text-white/50 z-40">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-yellow-400" />
            <span className="font-mono font-bold text-white">
              {totalPunches !== null ? totalPunches.toLocaleString() : "—"}
            </span>
            <span>punches</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-yellow-400" />
            <span className="font-mono font-bold text-white">
              {uniqueVisitors !== null ? uniqueVisitors.toLocaleString() : "—"}
            </span>
            <span>visitors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
