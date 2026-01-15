import { Sparkles, Zap, Rocket, Star } from "lucide-react";

const funMessages = [
  "🔮 Consulting the meme lords...",
  "🚀 Searching for the next 1000x...",
  "🎰 Rolling the degen dice...",
  "⚡ Channeling Pepe energy...",
  "💎 Mining diamond hands...",
  "🌙 Moon trajectory calculating...",
  "🦍 Apes assembling...",
  "🔥 Cooking up alpha...",
];

export function MemeLoadingAnimation() {
  const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1f] to-[#0d0d0f] overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          >
            <Star className="w-3 h-3 text-[#00d4aa]/30 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main character - cute meme frog */}
      <div className="relative z-10 flex flex-col items-center gap-1">
        <div className="relative">
          {/* Frog face */}
          <div className="text-3xl animate-bounce" style={{ animationDuration: '0.6s' }}>
            🐸
          </div>
          
          {/* Sparkle effects around the frog */}
          <Sparkles 
            className="absolute -top-1 -right-1 w-3 h-3 text-[#00d4aa] animate-ping" 
            style={{ animationDuration: '1s' }}
          />
          <Zap 
            className="absolute -bottom-1 -left-1 w-2.5 h-2.5 text-yellow-400 animate-pulse" 
          />
          <Rocket 
            className="absolute -top-0.5 -left-2 w-2.5 h-2.5 text-[#00d4aa]/70 animate-bounce" 
            style={{ animationDuration: '0.8s', animationDelay: '0.2s' }}
          />
        </div>
      </div>

      {/* Circular glow effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 rounded-full bg-[#00d4aa]/10 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
    </div>
  );
}

export function MemeLoadingText() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm font-bold text-[#00d4aa] animate-pulse">
          Generating...
        </span>
      </div>
      <p className="text-xs text-gray-400 italic">
        {funMessages[Math.floor(Date.now() / 2000) % funMessages.length]}
      </p>
      <p className="text-[10px] text-[#00d4aa]/70">
        Your next Binance listing meme coin incoming!
      </p>
    </div>
  );
}
