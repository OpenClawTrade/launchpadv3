import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface TickerToken {
  id: string;
  ticker: string;
  image_url: string | null;
  price_sol: number | null;
  price_change_24h: number | null;
  created_at: string;
}

export function TokenTickerBar() {
  const [tokens, setTokens] = useState<TickerToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchTokens() {
      const { data, error } = await supabase
        .from("fun_tokens")
        .select("id, ticker, image_url, price_sol, price_change_24h, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching ticker tokens:", error);
        return;
      }

      if (data) {
        setTokens(data);
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
    <div className="gate-ticker-bar w-full overflow-hidden">
      <div
        ref={scrollRef}
        className="gate-ticker-inner overflow-hidden whitespace-nowrap no-scrollbar"
        style={{ scrollBehavior: "auto" }}
      >
        {displayTokens.map((token, index) => {
          const priceChange = token.price_change_24h || 0;
          return (
            <Link
              key={`${token.id}-${index}`}
              to={`/token/${token.id}`}
              className="gate-ticker-item hover:opacity-80 transition-opacity"
            >
              {token.image_url ? (
                <img
                  src={token.image_url}
                  alt={token.ticker}
                  className="w-5 h-5 rounded-full object-cover animate-spin"
                  style={{ animationDuration: '3s' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground animate-spin" style={{ animationDuration: '3s' }}>
                  {token.ticker?.[0] || "?"}
                </div>
              )}
              <span className="gate-ticker-symbol">
                {token.ticker}
              </span>
              <span
                className={`gate-ticker-change ${
                  priceChange >= 0 ? "gate-price-up" : "gate-price-down"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
