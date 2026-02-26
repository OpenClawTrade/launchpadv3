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
import { Copy, CheckCircle, ExternalLink, Loader2, Rocket, MessageCircle, X, Twitter } from "lucide-react";
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

  // Dynamic SEO for punchlaunch.fun
  useEffect(() => {
    const isPunch = window.location.hostname === "punchlaunch.fun" || window.location.hostname === "www.punchlaunch.fun";
    if (!isPunch) return;

    document.title = "Punch and Launch";

    const setMeta = (attr: string, val: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${val}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr.split("=")[0], val); document.head.appendChild(el); }
      // fix: setAttribute properly
      if (attr === "name") el.setAttribute("name", val);
      else el.setAttribute("property", val);
      el.setAttribute("content", content);
    };

    const desc = "Punch the Viral Monkey Launchpad";
    const img = "https://punchlaunch.fun/punch-logo.jpg";

    setMeta("name", "description", desc);
    setMeta("property", "og:title", "Punch and Launch");
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", "https://punchlaunch.fun");
    setMeta("name", "twitter:title", "Punch and Launch");
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
    setMeta("name", "twitter:site", "@punchitsol");
    setMeta("name", "twitter:card", "summary_large_image");

    // Favicon
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = "/punch-logo.jpg";
    link.type = "image/jpeg";

    return () => { document.title = "Claw Mode"; };
  }, []);

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

  const getBarColor = () => {
    if (progress < 33) return "from-green-500 to-green-400";
    if (progress < 66) return "from-yellow-500 to-yellow-400";
    return "from-orange-500 to-red-500";
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

      {/* ===== TOP NAV BAR — integrated, professional ===== */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 70,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "10px 12px" : "12px 20px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
      }}>
        {/* Left — launched stat */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: isMobile ? 70 : 100 }}>
          <Rocket style={{ width: 14, height: 14, color: "#facc15", flexShrink: 0 }} />
          <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: isMobile ? 13 : 14, color: "#facc15" }}>
            {totalLaunched !== null ? totalLaunched.toLocaleString() : "0"}
          </span>
          <span style={{ fontSize: isMobile ? 9 : 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>launched</span>
        </div>

        {/* Right — nav pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="https://x.com/punchitsol"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="rgba(255,255,255,0.7)"/>
            </svg>
          </a>
          <button
            onClick={() => { setShowExtras(!showExtras); setShowFeed(false); }}
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: showExtras ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showExtras ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11, fontWeight: 600, color: showExtras ? "#facc15" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease",
            }}
          >
            {showExtras ? <X style={{ width: 11, height: 11 }} /> : <MessageCircle style={{ width: 11, height: 11 }} />}
            {showExtras ? "Close" : "Chat"}
          </button>
          <button
            onClick={() => { setShowFeed(!showFeed); setShowExtras(false); }}
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: showFeed ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showFeed ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11, fontWeight: 600, color: showFeed ? "#facc15" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease",
            }}
          >
            🔥 {showFeed ? "Close" : "Feed"}
          </button>
        </div>
      </div>

      {/* ===== HUD LAYER — tapping state overlays ===== */}
      {state === "tapping" && (
        <>
          {/* Title — centered below nav bar */}
          <div style={{
            position: "absolute", top: isMobile ? 48 : 54, left: 0, right: 0, zIndex: 50,
            textAlign: "center", pointerEvents: "none",
          }}>
            <h2 style={{
              fontSize: isMobile ? 15 : 20, fontWeight: 900, color: "#fff", margin: 0,
              letterSpacing: "-0.03em", lineHeight: 1.2,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}>
              PUNCH A BRANCH TO LAUNCH
            </h2>
            <p style={{ fontSize: isMobile ? 9 : 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
              Tap fast to fill the bar — don't stop!
            </p>
          </div>

          {/* Combo counter — right side, below nav */}
          <div style={{ position: "absolute", top: isMobile ? 80 : 95, right: isMobile ? 10 : 20, zIndex: 50 }}>
            <ComboCounter combo={combo} multiplier={multiplier} />
          </div>

          {/* Progress bar — bottom */}
          <div style={{ position: "absolute", bottom: 44, left: 120, right: 16, zIndex: 50, pointerEvents: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getBarColor()}`}
                style={{ width: `${progress}%`, transition: "width 100ms" }}
              />
            </div>
          </div>

          {/* Wallet prompt */}
          {showWalletPrompt && !isValidWallet && (
            <div
              style={{ position: "absolute", bottom: 70, left: 16, right: 16, zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ maxWidth: 380, margin: "0 auto", padding: 10, borderRadius: 12, border: "1px solid rgba(234,179,8,0.4)", background: "rgba(234,179,8,0.08)", backdropFilter: "blur(8px)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 6 }}>
                  🐵 Enter your Solana address Launch and receive fees!
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

      {/* ===== FEED OVERLAY ===== */}
      {showFeed && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setShowFeed(false); }}
        >
          <div
            style={{
              width: isMobile ? "92vw" : 400, maxHeight: "75vh",
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.15)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PunchTokenFeed />
          </div>
        </div>
      )}

      {/* ===== CHAT OVERLAY ===== */}
      {showExtras && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setShowExtras(false); }}
        >
          <div
            style={{
              width: isMobile ? "92vw" : 400, maxHeight: "80vh",
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.15)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "auto", padding: "16px 12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
