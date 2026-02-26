import { useEffect, useState } from "react";

interface PunchHeroHeaderProps {
  progress: number;
  multiplier: number;
  combo: number;
}

export function PunchHeroHeader({ progress, multiplier, combo }: PunchHeroHeaderProps) {
  const [shimmerOffset, setShimmerOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setShimmerOffset((prev) => (prev >= 100 ? 0 : prev + 1.5));
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const isHot = combo >= 8;
  const displayMultiplier = Math.round(multiplier * 10);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        pointerEvents: "none",
        padding: "12px 16px 0",
      }}
    >
      {/* Row 1: Pill badge + speed */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        {/* Left pill */}
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            background: "rgba(236, 72, 153, 0.08)",
            border: "1px solid rgba(236, 72, 153, 0.3)",
            boxShadow: "0 0 12px rgba(236, 72, 153, 0.15)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: "#ec4899",
            textTransform: "uppercase",
          }}
        >
          PUNCH A BRANCH
        </div>

        {/* Right speed indicator */}
        {multiplier > 1 && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#22d3ee",
              textShadow: "0 0 8px rgba(34, 211, 238, 0.5)",
            }}
          >
            {multiplier.toFixed(1)}× speed
          </div>
        )}
      </div>

      {/* Row 2: Big LAUNCH title */}
      <h1
        style={{
          textAlign: "center",
          fontSize: "clamp(2.5rem, 10vw, 4rem)",
          fontWeight: 900,
          lineHeight: 1,
          margin: "0 0 4px",
          letterSpacing: "-0.03em",
          background: "linear-gradient(90deg, #ec4899, #22d3ee, #ec4899)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "punch-gradient-shift 3s ease-in-out infinite",
        }}
      >
        LAUNCH
      </h1>

      {/* Row 3: Subtitle */}
      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.35)",
          margin: "0 0 14px",
          fontWeight: 500,
        }}
      >
        Tap fast to fill the bar — don't stop!
      </p>

      {/* Row 4: Progress bar */}
      <div style={{ position: "relative", maxWidth: 340, margin: "0 auto" }}>
        {/* Radial glow behind bar */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "120%",
            height: 60,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(ellipse, rgba(236,72,153,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* HOT badge */}
        {isHot && (
          <div
            style={{
              position: "absolute",
              top: -14,
              right: -4,
              padding: "2px 8px",
              borderRadius: 6,
              background: "#ec4899",
              color: "#000",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.05em",
              animation: "punch-hot-pulse 1.2s ease-in-out infinite",
              zIndex: 2,
            }}
          >
            HOT!
          </div>
        )}

        {/* Bar track */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 28,
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          {/* Fill */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${progress}%`,
              borderRadius: 14,
              background: "linear-gradient(90deg, #ec4899, #f472b6, #22d3ee)",
              transition: "width 100ms ease-out",
            }}
          />

          {/* Shimmer */}
          {progress > 5 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${shimmerOffset - 20}%`,
                width: "20%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                borderRadius: 14,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Center multiplier text */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 900,
              color: "#fff",
              textShadow: progress > 30
                ? "0 0 12px rgba(236,72,153,0.8), 0 0 24px rgba(236,72,153,0.4)"
                : "0 1px 3px rgba(0,0,0,0.5)",
              letterSpacing: "0.02em",
              fontFamily: "monospace",
              zIndex: 1,
            }}
          >
            {displayMultiplier > 10 ? `${displayMultiplier}×` : `${Math.round(progress)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
