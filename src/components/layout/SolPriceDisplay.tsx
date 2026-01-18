import { useState, useEffect } from "react";
import { TrendUp, TrendDown } from "@phosphor-icons/react";

interface PriceData {
  price: number;
  change24h: number;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112';

export function SolPriceDisplay() {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Try CoinGecko first for 24h change
        const cgResponse = await fetch(COINGECKO_API);
        if (cgResponse.ok) {
          const data = await cgResponse.json();
          if (data.solana) {
            setPriceData({
              price: data.solana.usd,
              change24h: data.solana.usd_24h_change || 0,
            });
            setIsLoading(false);
            return;
          }
        }

        // Fallback to Jupiter (no 24h change)
        const jupResponse = await fetch(JUPITER_PRICE_API);
        if (jupResponse.ok) {
          const data = await jupResponse.json();
          const price = data?.data?.['So11111111111111111111111111111111111111112']?.price;
          if (price) {
            setPriceData({
              price,
              change24h: 0,
            });
          }
        }
      } catch (error) {
        console.debug('[SolPriceDisplay] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (isLoading || !priceData) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1f] rounded-md animate-pulse">
        <svg viewBox="0 0 397.7 311.7" className="h-4 w-4 opacity-50" fill="none">
          <path fill="#9945FF" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
          <path fill="#9945FF" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
          <path fill="#9945FF" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
        </svg>
        <span className="text-xs text-gray-500">---</span>
      </div>
    );
  }

  const isPositive = priceData.change24h >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1f] rounded-md">
      {/* Solana Logo */}
      <svg viewBox="0 0 397.7 311.7" className="h-4 w-4" fill="none">
        <linearGradient id="solGrad1" x1="360.879" x2="141.213" y1="351.455" y2="-69.294" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <linearGradient id="solGrad2" x1="264.829" x2="45.163" y1="401.601" y2="-19.148" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <linearGradient id="solGrad3" x1="312.548" x2="92.882" y1="376.688" y2="-44.061" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <path fill="url(#solGrad1)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
        <path fill="url(#solGrad2)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
        <path fill="url(#solGrad3)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
      </svg>
      
      <span className="text-xs font-medium text-white">
        ${priceData.price.toFixed(2)}
      </span>
      
      <div className={`flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-green-400' : 'text-red-400'
      }`}>
        {isPositive ? (
          <TrendUp className="h-3 w-3" weight="bold" />
        ) : (
          <TrendDown className="h-3 w-3" weight="bold" />
        )}
        <span>{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
