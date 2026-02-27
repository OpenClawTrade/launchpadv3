import { useState } from "react";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PunchEarnedPanel() {
  const { toast } = useToast();

  return (
    <div style={{ padding: 16, color: "#fff" }}>
      <h3 style={{ fontSize: 16, fontWeight: 900, color: "#facc15", marginBottom: 4, textAlign: "center" }}>
        💰 Earned
      </h3>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 16 }}>
        Creator fee claims & processed transactions
      </p>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 20px", borderRadius: 12,
        background: "rgba(250,204,21,0.04)",
        border: "1px solid rgba(250,204,21,0.1)",
      }}>
        <span style={{ fontSize: 32, marginBottom: 12 }}>🚧</span>
        <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
          Coming Soon
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6, textAlign: "center", maxWidth: 260 }}>
          Track your creator earnings, fee claims, and on-chain distributions here.
        </p>
      </div>
    </div>
  );
}
