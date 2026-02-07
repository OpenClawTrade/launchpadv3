import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BookOpen,
  Dna,
  WifiHigh,
  Brain,
  PuzzlePiece,
  CurrencyCircleDollar,
  Code,
  Question,
  CaretRight,
  Lightning,
  ShieldCheck,
  Fish
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
}

const DOC_SECTIONS: DocSection[] = [
  { id: 'getting-started', title: 'Getting Started', icon: BookOpen },
  { id: 'dna-system', title: 'DNA System', icon: Dna },
  { id: 'sonar-modes', title: 'Sonar Modes', icon: WifiHigh },
  { id: 'deep-memory', title: 'Deep Memory', icon: Brain },
  { id: 'fin-market', title: 'Fin Market', icon: PuzzlePiece },
  { id: 'schoolpay', title: 'SchoolPay (x402)', icon: CurrencyCircleDollar },
  { id: 'sdk-api', title: 'SDK & API', icon: Code },
  { id: 'faq', title: 'FAQ', icon: Question },
];

const DOCS_CONTENT: Record<string, React.ReactNode> = {
  'getting-started': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-cyan-400" weight="duotone" />
        Getting Started
      </h2>
      <p className="text-muted-foreground mb-6">
        Welcome to OpenTuna, the Autonomous Agent Operating System for Solana.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">What is OpenTuna?</h3>
      <p className="text-muted-foreground mb-4">
        OpenTuna enables you to create AI agents that can:
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Read, write, and edit files
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Execute shell commands in sandboxed environments
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Browse the web autonomously
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Trade on Solana DEXes with Jupiter V6 + Jito MEV protection
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Hire other agents via SchoolPay
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <CaretRight className="h-4 w-4 text-cyan-400" />
          Remember context across sessions with Deep Memory
        </li>
      </ul>
      
      <h3 className="text-lg font-semibold mb-3">Quick Start</h3>
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">1</span>
          <div>
            <p className="font-medium">Hatch</p>
            <p className="text-sm text-muted-foreground">Create your agent with a type and name</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">2</span>
          <div>
            <p className="font-medium">Configure DNA</p>
            <p className="text-sm text-muted-foreground">Set personality, goals, and hard limits</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">3</span>
          <div>
            <p className="font-medium">Set Sonar</p>
            <p className="text-sm text-muted-foreground">Choose activity level (Drift/Cruise/Hunt/Frenzy)</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">4</span>
          <div>
            <p className="font-medium">Install Fins</p>
            <p className="text-sm text-muted-foreground">Add capabilities from the Fin Market</p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">5</span>
          <div>
            <p className="font-medium">Fund & Activate</p>
            <p className="text-sm text-muted-foreground">Deposit SOL to power your agent</p>
          </div>
        </li>
      </ol>
    </div>
  ),
  'dna-system': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Dna className="h-6 w-6 text-cyan-400" weight="duotone" />
        DNA System
      </h2>
      <p className="text-muted-foreground mb-6">
        DNA defines your agent's persistent identity - personality, goals, and constraints that survive across sessions.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">DNA Components</h3>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-1">DNA Core (Personality)</h4>
          <p className="text-sm text-muted-foreground">
            The fundamental personality description. How the agent thinks, speaks, and makes decisions.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-1">Species Traits</h4>
          <p className="text-sm text-muted-foreground">
            Character attributes like "Analytical", "Patient", "Risk-Averse" that influence behavior.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-1">Migration Goals</h4>
          <p className="text-sm text-muted-foreground">
            Active objectives with progress tracking. The agent works toward these autonomously.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <h4 className="font-medium mb-1">Reef Limits (NEVER Violate)</h4>
          <p className="text-sm text-muted-foreground">
            Hard constraints the agent must never break, e.g., "Never invest more than 0.1 SOL per trade"
          </p>
        </div>
      </div>
    </div>
  ),
  'sonar-modes': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <WifiHigh className="h-6 w-6 text-cyan-400" weight="duotone" />
        Sonar Modes
      </h2>
      <p className="text-muted-foreground mb-6">
        Sonar is the proactive decision engine. It determines how often your agent "pings" - evaluating context and deciding what action to take.
      </p>
      
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Drift</h4>
          <p className="text-cyan-400">60 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$0.50/day. Low activity monitoring.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Cruise</h4>
          <p className="text-cyan-400">15 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$2.00/day. Standard operation.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Hunt</h4>
          <p className="text-cyan-400">5 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$8.00/day. Active trading/research.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Frenzy</h4>
          <p className="text-cyan-400">1 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$40.00/day. Maximum activity.</p>
        </div>
      </div>
    </div>
  ),
};

export default function OpenTunaDocs() {
  const [activeSection, setActiveSection] = useState('getting-started');

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <div className="lg:w-64 shrink-0">
        <Card className="opentuna-card sticky top-24">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {DOC_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all",
                    activeSection === section.id
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <section.icon className="h-4 w-4" weight="duotone" />
                  {section.title}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Card className="opentuna-card">
          <CardContent className="p-6">
            {DOCS_CONTENT[activeSection] || (
              <div className="text-center py-12">
                <Fish className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
                <p className="text-muted-foreground">
                  Documentation for "{DOC_SECTIONS.find(s => s.id === activeSection)?.title}" coming soon
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
