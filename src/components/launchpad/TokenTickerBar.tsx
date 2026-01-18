import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSolPrice } from "@/hooks/useSolPrice";

interface TickerToken {
  id: string;
  ticker: string;
  image_url: string | null;
  price_sol: number | null;
  market_cap_sol: number | null;
  bonding_progress: number | null;
  created_at: string;
}

interface TokenWithChange extends TickerToken {
  priceChange: number;
}

export function TokenTickerBar() {
  const [tokens, setTokens] = useState<TokenWithChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { solPrice } = useSolPrice();

  useEffect(() => {
    async function fetchTokens() {
      const { data, error } = await supabase
        .from("fun_tokens")
        .select("id, ticker, image_url, price_sol, market_cap_sol, bonding_progress, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching ticker tokens:", error);
        return;
      }

      if (data) {
        // Calculate a mock price change based on bonding progress
        // In production, you'd use historical price data
        const tokensWithChange = data.map((token) => {
          // Use bonding progress to simulate momentum
          // Tokens with higher bonding = more demand = positive change
          const progress = token.bonding_progress || 0;
          const baseChange = (progress - 35) * 2; // Center around 35% progress
          // Add some variance based on market cap
          const mcapFactor = Math.log10(Math.max(token.market_cap_sol || 30, 30)) - 1.5;
          const priceChange = baseChange + mcapFactor * 10;
          
          return {
            ...token,
            priceChange: Math.round(priceChange * 100) / 100,
          };
        });
        
        setTokens(tokensWithChange);
      }
      setIsLoading(false);
    }

    fetchTokens();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchTokens, 60000);
    return () => clearInterval(interval);
  }, []);

  // Continuous scroll animation
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || tokens.length === 0) return;

    let animationId: number;
    let scrollPos = 0;
    const speed = 0.5; // pixels per frame

    const animate = () => {
      scrollPos += speed;
      if (scrollPos >= scroll.scrollWidth / 2) {
        scrollPos = 0;
      }
      scroll.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    
    // Pause on hover
    const handleMouseEnter = () => cancelAnimationFrame(animationId);
    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };
    
    scroll.addEventListener("mouseenter", handleMouseEnter);
    scroll.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scroll.removeEventListener("mouseenter", handleMouseEnter);
      scroll.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [tokens]);

  if (isLoading || tokens.length === 0) {
    return null;
  }

  // Duplicate tokens for seamless loop
  const displayTokens = [...tokens, ...tokens];

  return (
    <div className="bg-[#0a0a0c] border-b border-[#1a1a1f] overflow-hidden">
      <div
        ref={scrollRef}
        className="flex items-center gap-6 py-2 px-4 overflow-hidden whitespace-nowrap"
        style={{ scrollBehavior: "auto" }}
      >
        {displayTokens.map((token, index) => (
          <a
            key={`${token.id}-${index}`}
            href={`/token/${token.id}`}
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          >
            {token.image_url ? (
              <img
                src={token.image_url}
                alt={token.ticker}
                className="w-5 h-5 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                {token.ticker?.[0] || "?"}
              </div>
            )}
            <span className="text-sm font-medium text-white">
              {token.ticker}
            </span>
            <span
              className={`text-sm font-medium ${
                token.priceChange >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {token.priceChange >= 0 ? "+" : ""}
              {token.priceChange.toFixed(2)}%
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
