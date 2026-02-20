import { Sparkles, Zap, Rocket, Star } from "lucide-react";

const TUNA_LOGO_SRC = "/claw-logo.png";

const funMessages = [
  "🔮 Consulting the meme lords...",
  "🚀 Searching for the next 1000x...",
  "🎰 Rolling the degen dice...",
  "⚡ Channeling Claw Mode energy...",
  "💎 Mining diamond hands...",
  "🌙 Moon trajectory calculating...",
  "🦍 Apes assembling...",
  "🔥 Cooking up alpha...",
];

export function MemeLoadingAnimation() {
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--background))] overflow-hidden rounded-lg">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${10 + i * 20}%`,
              top: `${15 + (i % 2) * 30}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          >
            <Star className="w-2 h-2 text-primary/30 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Circular glow effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
      </div>

      {/* Main TUNA logo */}
      <div className="relative z-10">
        <img 
          src={TUNA_LOGO_SRC} 
          alt="Claw Mode" 
          className="w-10 h-10 rounded-lg object-cover animate-bounce"
          style={{ animationDuration: '0.6s', mixBlendMode: 'screen' }}
        />
        
        {/* Sparkle effects around the logo */}
        <Sparkles 
          className="absolute -top-1 -right-1 w-2.5 h-2.5 text-primary animate-ping" 
          style={{ animationDuration: '1s' }}
        />
        <Zap 
          className="absolute -bottom-0.5 -left-0.5 w-2 h-2 text-accent animate-pulse" 
        />
        <Rocket 
          className="absolute -top-0.5 -left-1.5 w-2 h-2 text-primary/70 animate-bounce" 
          style={{ animationDuration: '0.8s', animationDelay: '0.2s' }}
        />
      </div>
    </div>
  );
}

export function MemeLoadingText() {
  return (
    <div className="space-y-1.5">
      {/* Bouncing dots + Generating label */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm font-bold text-primary animate-pulse">
          Generating...
        </span>
      </div>
      
      {/* Fun rotating message */}
      <p className="text-xs text-muted-foreground italic">
        {funMessages[Math.floor(Date.now() / 2000) % funMessages.length]}
      </p>
      
      {/* Tagline */}
      <p className="text-[10px] text-primary/70">
        Your next moonshot meme coin incoming!
      </p>
    </div>
  );
}
