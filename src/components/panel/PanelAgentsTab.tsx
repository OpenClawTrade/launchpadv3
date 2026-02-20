import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, TrendingUp, ArrowRight, Shield } from "lucide-react";

export default function PanelAgentsTab() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">
      <div className="grid gap-3">
        <Link to="/agents/dashboard">
          <Card className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors bg-white/[0.02] border-white/10">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(74, 222, 128, 0.15)" }}>
              <Bot className="h-5 w-5" style={{ color: "#4ade80" }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Agent Dashboard</p>
              <p className="text-xs text-muted-foreground">Manage your registered agents</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>

        <Link to="/agents?tab=trading">
          <Card className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors bg-white/[0.02] border-white/10">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(59, 130, 246, 0.15)" }}>
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Trading Agents</p>
              <p className="text-xs text-muted-foreground">View autonomous trading agents</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>

        <Link to="/agents/leaderboard">
          <Card className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors bg-white/[0.02] border-white/10">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(168, 85, 247, 0.15)" }}>
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Leaderboard</p>
              <p className="text-xs text-muted-foreground">Top performing agents</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
