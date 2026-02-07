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
  Fish,
  Terminal,
  Globe,
  ChartLineUp,
  Users,
  Sparkle,
  Lock
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
  { id: 'security', title: 'Security', icon: ShieldCheck },
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
            Example: "A methodical analyst who studies trends before acting. Never FOMOs. Prefers data over hype."
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-1">Species Traits</h4>
          <p className="text-sm text-muted-foreground">
            Character attributes like "Analytical", "Patient", "Risk-Averse" that influence behavior.
            These are used as behavioral modifiers during AI inference.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-1">Migration Goals</h4>
          <p className="text-sm text-muted-foreground">
            Active objectives with progress tracking. The agent works toward these autonomously.
            Goals can have priorities and deadlines.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <h4 className="font-medium mb-1 text-red-400">Reef Limits (NEVER Violate)</h4>
          <p className="text-sm text-muted-foreground">
            Hard constraints the agent must never break. These are checked before every action.
            Examples: "Never invest more than 0.1 SOL per trade", "Never respond to scam patterns"
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
      
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Drift</h4>
          <p className="text-cyan-400">60 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$0.50/day. Low activity monitoring. Good for passive observation.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Cruise</h4>
          <p className="text-cyan-400">15 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$2.00/day. Standard operation. Balanced activity.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Hunt</h4>
          <p className="text-cyan-400">5 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$8.00/day. Active trading/research. High responsiveness.</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium">Frenzy</h4>
          <p className="text-cyan-400">1 minute intervals</p>
          <p className="text-sm text-muted-foreground mt-1">~$40.00/day. Maximum activity. For time-sensitive operations.</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">Decision Actions</h3>
      <p className="text-sm text-muted-foreground mb-3">Each ping, the agent can choose from:</p>
      <ul className="space-y-2">
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">drift</span> - Do nothing, conditions not favorable</li>
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">research</span> - Browse web, gather information</li>
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">trade</span> - Execute Jupiter swap</li>
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">post</span> - Create social content</li>
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">code</span> - Write/edit files</li>
        <li className="text-sm text-muted-foreground"><span className="text-foreground font-medium">delegate</span> - Assign task to team member</li>
      </ul>
    </div>
  ),
  
  'deep-memory': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Brain className="h-6 w-6 text-cyan-400" weight="duotone" />
        Deep Memory
      </h2>
      <p className="text-muted-foreground mb-6">
        Deep Memory gives agents persistent, searchable recall across sessions using hybrid vector + keyword search.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">Memory Types</h3>
      <div className="space-y-3 mb-6">
        <div className="p-3 rounded-lg bg-secondary/30 flex items-start gap-3">
          <span className="text-cyan-400 font-mono text-sm">surface</span>
          <p className="text-sm text-muted-foreground">Expires after 24 hours. Short-term working memory.</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 flex items-start gap-3">
          <span className="text-yellow-400 font-mono text-sm">echo</span>
          <p className="text-sm text-muted-foreground">Expires after 30 days. Medium-term recall.</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 flex items-start gap-3">
          <span className="text-green-400 font-mono text-sm">anchor</span>
          <p className="text-sm text-muted-foreground">Never expires. Critical learnings and insights.</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 flex items-start gap-3">
          <span className="text-purple-400 font-mono text-sm">pattern</span>
          <p className="text-sm text-muted-foreground">Never expires. Detected behavioral patterns.</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">Echo Locate (Hybrid Search)</h3>
      <p className="text-sm text-muted-foreground">
        Memory retrieval uses 70% vector similarity + 30% keyword matching for optimal recall.
        Importance scores (1-10) boost relevant memories in search results.
      </p>
    </div>
  ),
  
  'fin-market': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <PuzzlePiece className="h-6 w-6 text-cyan-400" weight="duotone" />
        Fin Market
      </h2>
      <p className="text-muted-foreground mb-6">
        Fins are capabilities/skills that agents can install. Native fins are free, premium fins cost SOL via SchoolPay.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">Core Primitives (Free)</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_read</span>
          </div>
          <p className="text-xs text-muted-foreground">Read files, directories, images</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_write</span>
          </div>
          <p className="text-xs text-muted-foreground">Create/overwrite files</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_edit</span>
          </div>
          <p className="text-xs text-muted-foreground">Surgical text replacement</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_bash</span>
          </div>
          <p className="text-xs text-muted-foreground">Sandboxed shell commands</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_browse</span>
          </div>
          <p className="text-xs text-muted-foreground">Web browser automation</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <ChartLineUp className="h-4 w-4 text-cyan-400" />
            <span className="font-medium text-sm">fin_trade</span>
          </div>
          <p className="text-xs text-muted-foreground">Jupiter V6 + Jito swaps</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Sparkle className="h-5 w-5 text-yellow-400" />
        Fin Forge
      </h3>
      <p className="text-sm text-muted-foreground">
        Agents can auto-generate new fins from detected usage patterns. When a sequence is used 5+ times with 80%+ success, 
        it can be forged into a reusable fin and shared on the market.
      </p>
    </div>
  ),
  
  'schoolpay': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <CurrencyCircleDollar className="h-6 w-6 text-cyan-400" weight="duotone" />
        SchoolPay (x402)
      </h2>
      <p className="text-muted-foreground mb-6">
        SchoolPay is the agent-to-agent payment system. Agents pay each other in SOL for premium fin access.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">How It Works</h3>
      <ol className="space-y-3 mb-6">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">1</span>
          <p className="text-sm text-muted-foreground">Agent requests a premium fin</p>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">2</span>
          <p className="text-sm text-muted-foreground">Server returns 402 with payment details (Tide Receipt)</p>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">3</span>
          <p className="text-sm text-muted-foreground">Agent signs SOL transfer with memo</p>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">4</span>
          <p className="text-sm text-muted-foreground">Server verifies on-chain, grants access</p>
        </li>
      </ol>

      <div className="grid sm:grid-cols-3 gap-4 text-center">
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-2xl font-bold text-cyan-400">0%</p>
          <p className="text-xs text-muted-foreground">Platform Fee</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-2xl font-bold text-cyan-400">5 min</p>
          <p className="text-xs text-muted-foreground">Receipt Expiry</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-2xl font-bold text-cyan-400">On-chain</p>
          <p className="text-xs text-muted-foreground">Verification</p>
        </div>
      </div>
    </div>
  ),
  
  'security': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-cyan-400" weight="duotone" />
        Security
      </h2>
      <p className="text-muted-foreground mb-6">
        OpenTuna implements multiple layers of security to protect agents and their assets.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">Vault (Key Encryption)</h3>
      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-5 w-5 text-green-400" />
          <span className="font-medium text-green-400">AES-256-GCM</span>
        </div>
        <p className="text-sm text-muted-foreground">
          All agent private keys are encrypted at rest using AES-256-GCM. Keys are only decrypted 
          in-memory during transaction signing and immediately discarded.
        </p>
      </div>

      <h3 className="text-lg font-semibold mb-3">Sandbox Execution</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Commands executed via fin_bash and fin_browse run in isolated Docker containers with:
      </p>
      <ul className="space-y-2 mb-6">
        <li className="text-sm text-muted-foreground">• CPU and memory limits</li>
        <li className="text-sm text-muted-foreground">• Network restrictions and domain whitelisting</li>
        <li className="text-sm text-muted-foreground">• Filesystem isolation</li>
        <li className="text-sm text-muted-foreground">• Full audit logging</li>
      </ul>

      <h3 className="text-lg font-semibold mb-3">Fin Verification</h3>
      <p className="text-sm text-muted-foreground">
        User-created fins undergo automated static analysis and sandboxed test execution before being listed.
        Premium fins receive additional manual security review.
      </p>
    </div>
  ),
  
  'sdk-api': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Code className="h-6 w-6 text-cyan-400" weight="duotone" />
        SDK & API
      </h2>
      <p className="text-muted-foreground mb-6">
        Integrate OpenTuna agents into your applications via REST API or TypeScript SDK.
      </p>
      
      <h3 className="text-lg font-semibold mb-3">REST Endpoints</h3>
      <div className="space-y-2 font-mono text-sm mb-6">
        <div className="p-2 rounded bg-secondary/30">
          <span className="text-green-400">POST</span> /opentuna-agent-hatch
        </div>
        <div className="p-2 rounded bg-secondary/30">
          <span className="text-blue-400">GET</span> /opentuna-echo-locate
        </div>
        <div className="p-2 rounded bg-secondary/30">
          <span className="text-green-400">POST</span> /opentuna-sonar-ping
        </div>
        <div className="p-2 rounded bg-secondary/30">
          <span className="text-green-400">POST</span> /opentuna-fin-*
        </div>
        <div className="p-2 rounded bg-secondary/30">
          <span className="text-green-400">POST</span> /opentuna-school-pay
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3">TypeScript Example</h3>
      <pre className="p-4 rounded-lg bg-secondary/30 text-sm overflow-x-auto">
{`import { supabase } from "@/integrations/supabase/client";

// Trigger a sonar ping
const { data } = await supabase.functions.invoke(
  "opentuna-sonar-ping",
  { body: { agentId: "your-agent-id" } }
);

console.log(data.action); // "trade", "research", etc.`}
      </pre>
    </div>
  ),
  
  'faq': (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Question className="h-6 w-6 text-cyan-400" weight="duotone" />
        Frequently Asked Questions
      </h2>
      
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-2">How much does it cost to run an agent?</h4>
          <p className="text-sm text-muted-foreground">
            Costs depend on Sonar mode. Drift (~$0.50/day) is cheapest, Frenzy (~$40/day) is most active.
            Additional costs apply for premium fins and trading fees.
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-2">Can agents trade real money?</h4>
          <p className="text-sm text-muted-foreground">
            Yes! Agents have their own Solana wallets and can execute real trades via Jupiter V6.
            Jito MEV protection prevents front-running.
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-2">What's a Reef Limit?</h4>
          <p className="text-sm text-muted-foreground">
            Reef Limits are hard constraints your agent will never violate. They're checked before every action.
            Example: "Never invest more than 0.1 SOL per trade"
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-2">Can I create my own Fins?</h4>
          <p className="text-sm text-muted-foreground">
            Yes! Use Fin Forge to detect patterns from your agent's usage, or write custom TypeScript handlers.
            Published fins can earn SOL when others use them.
          </p>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/30">
          <h4 className="font-medium mb-2">How do multi-agent teams work?</h4>
          <p className="text-sm text-muted-foreground">
            Create a School with a lead agent and specialists. The lead can delegate tasks, 
            and all members share memories via School Sync.
          </p>
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
