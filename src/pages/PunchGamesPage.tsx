import { Gamepad2, ArrowLeft, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

export default function PunchGamesPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a00 50%, #0a0a0a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
      }}
    >
      {/* Back button */}
      <Link
        to="/punch-test"
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "rgba(255,255,255,0.5)",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
          padding: "6px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          transition: "all 150ms ease",
        }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Back to Punch
      </Link>

      {/* Main content */}
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "rgba(250,204,21,0.1)",
            border: "1px solid rgba(250,204,21,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Gamepad2 style={{ width: 40, height: 40, color: "#facc15" }} />
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
          }}
        >
          🎮 Games Coming Soon
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.7,
            maxWidth: 400,
          }}
        >
          Punch is currently developing this page. It should be ready soon!
          Here you will be able to create tokens through fun mini-games.
          We'll code them for you — just bring your ideas.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 12,
            background: "rgba(250,204,21,0.08)",
            border: "1px solid rgba(250,204,21,0.15)",
          }}
        >
          <Rocket style={{ width: 16, height: 16, color: "#facc15" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(250,204,21,0.8)" }}>
            Stay tuned for updates
          </span>
        </div>
      </div>
    </div>
  );
}
