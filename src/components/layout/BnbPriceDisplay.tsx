import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  price: number;
  change24h: number;
}

const CACHE_KEY = 'bnb_price_display_cache';
const CACHE_TTL = 30000;

export function BnbPriceDisplay() {
  const [priceData, setPriceData] = useState<PriceData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL * 2) {
          return { price: parsed.price, change24h: parsed.change24h };
        }
      }
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState(!priceData);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('bnb-price');
        if (error) throw error;

        if (data?.price) {
          const newData = { price: data.price, change24h: data.change24h || 0 };
          setPriceData(newData);
          setIsLoading(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...newData, timestamp: Date.now() }));
        }
      } catch (error) {
        console.debug('[BnbPriceDisplay] Error:', error);
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const BnbLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path fill="#fff" d="M16 6l3.09 3.09L12.18 16l6.91 6.91L16 26l-10-10z" />
      <path fill="#fff" d="M21.82 12.18L16 6l-2.18 2.18L19.64 14l-5.82 5.82L16 22l10-10z" />
      <path fill="#fff" d="M8.18 16l2.18-2.18L12.55 16l-2.18 2.18z" />
      <path fill="#fff" d="M23.82 16l-2.18-2.18L19.45 16l2.18 2.18z" />
    </svg>
  );

  if (isLoading || !priceData) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md animate-pulse">
        <BnbLogo className="h-4 w-4 opacity-50" />
        <span className="text-xs text-muted-foreground">---</span>
      </div>
    );
  }

  const isPositive = priceData.change24h >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md">
      <BnbLogo className="h-4 w-4" />
      <span className="text-xs font-medium text-foreground">
        ${priceData.price.toFixed(2)}
      </span>
      <div className={`flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-success' : 'text-destructive'
      }`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
