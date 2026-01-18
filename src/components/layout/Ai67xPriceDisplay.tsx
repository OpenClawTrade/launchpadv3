import ai67xLogo from "@/assets/ai69x-logo.png";
import { Minus } from "lucide-react";

export function Ai67xPriceDisplay() {
  // Mockup for now - token not launched yet
  const price = 0;
  const change24h = 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1f] rounded-md">
      <img 
        src={ai67xLogo} 
        alt="ai67x" 
        className="h-4 w-4 rounded-full"
      />
      
      <span className="text-xs font-medium text-white">
        ${price.toFixed(4)}
      </span>
      
      <div className="flex items-center gap-0.5 text-xs font-medium text-gray-500">
        <Minus className="h-3 w-3" />
        <span>{change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
