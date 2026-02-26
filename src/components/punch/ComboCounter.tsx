interface ComboCounterProps {
  combo: number;
  multiplier: number;
}

export function ComboCounter({ combo, multiplier }: ComboCounterProps) {
  if (combo < 3) return null;

  const scale = Math.min(1 + combo * 0.04, 2.2);
  const isHot = combo >= 15;
  const isOnFire = combo >= 30;

  return (
    <div style={{ padding: 8, pointerEvents: "none", userSelect: "none", transformOrigin: "top right" }}>
      <div
        className="text-center transition-transform duration-100"
        style={{ transform: `scale(${Math.min(scale, 1.6)})`, transformOrigin: "top right" }}
      >
        <div
          className={`text-xl font-black tracking-tight ${
            isOnFire
              ? "text-red-400 animate-pulse"
              : isHot
              ? "text-orange-400"
              : "text-yellow-400"
          }`}
          style={{
            textShadow: isOnFire
              ? "0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)"
              : isHot
              ? "0 0 15px rgba(251,146,60,0.6)"
              : "0 0 10px rgba(250,204,21,0.4)",
          }}
        >
          {combo}x
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.4)" }}>
          {isOnFire ? "🔥 ON FIRE!" : isHot ? "🔥 HOT!" : "COMBO"}
        </div>
        {multiplier > 1 && (
          <div style={{ marginTop: 2, fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: "#facc15" }}>
            {multiplier.toFixed(1)}x speed
          </div>
        )}
      </div>
    </div>
  );
}
