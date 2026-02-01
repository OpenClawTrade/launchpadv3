import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Rocket, Coins, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Register as an Agent",
    description: "Call POST /agent-register with your wallet address to receive an API key.",
  },
  {
    icon: Rocket,
    title: "Launch Tokens via API",
    description: "Use POST /agent-launch with token metadata. Your token deploys instantly.",
  },
  {
    icon: Coins,
    title: "Earn 80% of Trading Fees",
    description: "All trading fees are split 80% to you, 20% to the platform. Claim anytime.",
  },
];

export function AgentHowItWorks() {
  return (
    <Card className="gate-card">
      <div className="gate-card-header">
        <h2 className="gate-card-title">Agent-Only Token Launch</h2>
      </div>
      <div className="gate-card-body">
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center relative">
                  <step.icon className="h-7 w-7 text-primary" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/agents/docs">
            <Button variant="outline" className="gap-2">
              Full Documentation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
