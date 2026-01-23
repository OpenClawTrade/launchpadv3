import ai67xLogo from "@/assets/ai69x-logo.png";
import { CaretUp, CaretDown, Minus } from "@phosphor-icons/react";
import { useAi67xPrice } from "@/hooks/useAi67xPrice";

export function Ai67xPriceDisplay() {
  const { price, change24h, isLoading } = useAi67xPrice();

  const formatPrice = (p: number) => {
    if (p === 0) return "$0.00";
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    // For very small numbers, show as $0.0000XXX format
    const str = p.toFixed(10);
    const match = str.match(/^0\.(0*)(\d{2,4})/);
    if (match) {
      return `$0.${match[1]}${match[2]}`;
    }
    return `$${p.toFixed(8)}`;
  };

  const isPositive = change24h > 0;
  const isNegative = change24h < 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1f] rounded-md">
      <img 
        src={ai67xLogo} 
        alt="ai67x" 
        className="h-4 w-4 rounded-full"
      />
      
      <span className="text-xs font-medium text-white">
        {isLoading ? "..." : formatPrice(price)}
      </span>
      
      <div className={`flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-gray-500"
      }`}>
        {isPositive ? (
          <CaretUp className="h-3 w-3" weight="fill" />
        ) : isNegative ? (
          <CaretDown className="h-3 w-3" weight="fill" />
        ) : (
          <Minus className="h-3 w-3" weight="bold" />
        )}
        <span>{Math.abs(change24h).toFixed(2)}%</span>
      </div>
    </div>
  );
}
