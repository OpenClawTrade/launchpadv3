import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PunchHeroHeader } from "@/components/punch/PunchHeroHeader";
import { PunchConfetti } from "@/components/punch/PunchConfetti";
import { PunchTokenFeed } from "@/components/punch/PunchTokenFeed";
import { PunchLivestream } from "@/components/punch/PunchLivestream";
import { PunchChatBox } from "@/components/punch/PunchChatBox";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, ExternalLink, Loader2, Rocket, MessageCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePunchTokenCount } from "@/hooks/usePunchTokenCount";
import { usePunchPageStats } from "@/hooks/usePunchPageStats";
import { useIsMobile } from "@/hooks/use-mobile";

type GameState = "tapping" | "launching" | "result";

const STEPS = 18;
const TAPS_TO_WIN = 50;
const DECAY_RATE = 1.2;
const COMBO_WINDOW_MS = 300;
const REQUIRED_TAPS = 50;

export default function PunchTestPage() {
  const { toast } = useToast();
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors, reportPunches } = usePunchPageStats();
  const isMobile = useIsMobile();

  const [state, setState] = useState<GameState>("tapping");
  const [progress, setProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [tapping, setTapping] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
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

  const step = Math.round((progress / 100) * STEPS);

  const getMovePx = () => Math.max(4, Math.min(10, window.innerWidth / 100));
  const getMoveY = () => Math.max(1.5, Math.min(3, window.innerWidth / 200));

  const lastTapTime = useRef(0);
  const tapCount = useRef(0);
  const progressRef = useRef(0);
  const decayTimer = useRef<ReturnType<typeof setInterval>>();
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();

  const isValidWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

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

    if (tapCount.current >= 30 && !isValidWallet) {
      setShowWalletPrompt(true);
    }

    if (timeSinceLastTap < COMBO_WINDOW_MS && timeSinceLastTap > 0) {
      setCombo((c) => c + 1);
      setMultiplier((m) => Math.min(m + 0.1, 3));
    } else {
      setCombo(0);
      setMultiplier(1);
    }

    const increment = (100 / TAPS_TO_WIN) * Math.min(multiplier, 3);
    progressRef.current = Math.min(100, progressRef.current + increment);
    setProgress(progressRef.current);

    setShaking(true);
    setTapping(true);
    if (tapTimeout.current) clearTimeout(tapTimeout.current);
    tapTimeout.current = setTimeout(() => {
      setShaking(false);
      setTapping(false);
    }, 80);

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

  const movePx = getMovePx();
  const moveY = getMoveY();
  const isLaunching = state === "launching";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000", position: "fixed", top: 0, left: 0 }}>
      <PunchConfetti active={showConfetti} />

      {/* ===== PURE ANIMATION LAYER — untouched from original ===== */}
      <div
        onClick={() => {
          if (showExtras || showFeed) return;
          handleTap();
        }}
        className={shaking ? "punch-screen-shake" : ""}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: state === "tapping" ? "pointer" : "default",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        {/* Branch + toy scene */}
        <div
          style={{
            position: "relative",
            marginRight: "2vw",
            marginTop: "-18vh",
            width: "72vw",
            maxWidth: 720,
            transform: "rotate(-7deg)",
            zIndex: 4,
            opacity: isLaunching ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: isLaunching ? "none" : undefined,
          }}
        >
          <img
            src="/branch.png"
            alt="branch"
            draggable={false}
            style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.08))", pointerEvents: "none" }}
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
            width: "30vw",
            maxWidth: 420,
            height: "auto",
            zIndex: 2,
            filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.1))",
            right: "calc(50% - 33vw)",
            bottom: "calc(50% - 32vw)",
            opacity: isLaunching ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: "none",
          }}
        />

        {/* Final hug image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            zIndex: 10,
            opacity: isLaunching ? 1 : 0,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: isLaunching ? undefined : "none",
          }}
        >
          <img
            src="/final.png"
            alt="Victory"
            draggable={false}
            style={{ maxWidth: "80vw", maxHeight: "80vh", width: "auto", height: "auto", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* ===== PREMIUM HUD LAYER ===== */}
      {state === "tapping" && (
        <>
          <PunchHeroHeader progress={progress} multiplier={multiplier} combo={combo} />

          {/* Wallet prompt — only appears after 30 taps, positioned above footer */}
          {showWalletPrompt && !isValidWallet && (
            <div
              style={{ position: "absolute", bottom: 44, left: 16, right: 16, zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ maxWidth: 380, margin: "0 auto", padding: 10, borderRadius: 12, border: "1px solid rgba(236,72,153,0.3)", background: "rgba(236,72,153,0.06)", backdropFilter: "blur(8px)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 6 }}>
                  Enter your Solana address to receive fees
                </p>
                <Input
                  placeholder="Your Solana wallet address"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  className="text-center font-mono text-xs bg-black/80 border-white/20 text-white"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Launching overlay text */}
      {isLaunching && (
        <div style={{ position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 50, display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating & launching on-chain...
        </div>
      )}

      {launchError && (
        <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", zIndex: 50, fontSize: 11, color: "#f87171", textAlign: "center" }}>
          {launchError}
        </div>
      )}

      {/* ===== RESULT STATE ===== */}
      {state === "result" && result && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
          <div className="max-w-sm w-full space-y-5 animate-fade-in text-center px-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-black text-white">TOKEN LAUNCHED!</h2>

            {result.imageUrl && (
              <img src={result.imageUrl} alt={result.name} className="w-32 h-32 rounded-2xl mx-auto border-2 border-white/20 object-cover" />
            )}

            <div>
              <p className="text-lg font-bold text-white">{result.name}</p>
              <p className="text-sm text-yellow-400 font-mono">${result.ticker}</p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <code className="text-[11px] font-mono text-white/80 flex-1 truncate">{result.mintAddress}</code>
              <button onClick={copyAddress} className="text-white/50 hover:text-white">
                {copiedAddress ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link to={`/launchpad/${result.mintAddress}`}>View Token</Link>
              </Button>
              <Button asChild variant="outline" size="icon">
                <a href={`https://solscan.io/token/${result.mintAddress}`} target="_blank" rel="noopener noreferrer">
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

      {/* ===== CORNER BUTTONS — non-intrusive ===== */}

      {/* Feed toggle */}
      <button
        onClick={() => { setShowFeed(!showFeed); setShowExtras(false); }}
        style={{ position: "absolute", top: 14, right: 14, zIndex: 70, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}
      >
        {showFeed ? "✕ Close" : "🔥 Feed"}
      </button>

      {/* Chat/Extras toggle */}
      <button
        onClick={() => { setShowExtras(!showExtras); setShowFeed(false); }}
        style={{ position: "absolute", top: 14, right: showFeed ? 14 : 90, zIndex: 70, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      >
        {showExtras ? <><X style={{ width: 12, height: 12 }} /> Close</> : <><MessageCircle style={{ width: 12, height: 12 }} /> Chat</>}
      </button>

      {/* ===== FEED OVERLAY ===== */}
      {showFeed && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ height: "100%", paddingTop: 48 }}>
            <PunchTokenFeed />
          </div>
        </div>
      )}

      {/* ===== EXTRAS OVERLAY (Livestream + Chat) ===== */}
      {showExtras && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ maxWidth: 420, margin: "0 auto", padding: "56px 16px 24px" }}>
            <PunchLivestream />
            <PunchChatBox />
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 8 }}>
              Limited to 1 launch per 3 minutes per IP
            </p>
          </div>
        </div>
      )}

      {/* ===== MONKEY-THEMED STATS BAR — bottom ===== */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
        borderTop: "1px solid rgba(250,204,21,0.15)", 
        background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,10,0,0.95) 100%)",
        backdropFilter: "blur(6px)", padding: "6px 16px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
        fontSize: 11, color: "rgba(255,255,255,0.4)", pointerEvents: "none",
      }}>
        <span style={{ fontSize: 14 }}>🐵</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12 }}>👊</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
            {totalPunches !== null ? totalPunches.toLocaleString() : "—"}
          </span>
          <span>punches</span>
        </div>
        <span style={{ color: "rgba(250,204,21,0.3)" }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12 }}>🌴</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
            {uniqueVisitors !== null ? uniqueVisitors.toLocaleString() : "—"}
          </span>
          <span>punchers</span>
        </div>
        <span style={{ color: "rgba(250,204,21,0.3)" }}>|</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Rocket style={{ width: 12, height: 12, color: "#facc15" }} />
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
            {totalLaunched !== null ? totalLaunched.toLocaleString() : "—"}
          </span>
          <span>launched</span>
        </div>
      </div>
    </div>
  );
}
