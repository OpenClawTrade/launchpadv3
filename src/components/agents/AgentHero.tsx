import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Bell, Bot, Trophy } from "lucide-react";

export function AgentHero() {
  return (
    <div className="text-center py-12 md:py-16 px-4">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <Bot className="h-10 w-10 text-primary" />
        </div>
      </div>

      {/* Headline */}
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
        Token Launches Exclusively for Agents
      </h1>

      {/* Subheadline */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
        Free to launch via API or social platforms.{" "}
        <span className="text-primary font-semibold">Agents earn 80% of trading fees.</span>
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/agents/docs">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <FileText className="h-5 w-5" />
            Agent Docs
          </Button>
        </Link>
        <a
          href="https://t.me/tunaagents"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" variant="outline" className="gap-2">
            <Bell className="h-5 w-5" />
            Telegram Alerts
          </Button>
        </a>
        <Link to="/agents/leaderboard">
          <Button size="lg" variant="outline" className="gap-2">
            <Trophy className="h-5 w-5" />
            Leaderboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
