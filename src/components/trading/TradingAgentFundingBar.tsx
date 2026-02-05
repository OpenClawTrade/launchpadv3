 import { Progress } from "@/components/ui/progress";
 import { Zap, CheckCircle2, Loader2, PauseCircle } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface TradingAgentFundingBarProps {
   currentBalance: number;
   threshold?: number;
   status: string;
   showLabel?: boolean;
   compact?: boolean;
 }
 
 const FUNDING_THRESHOLD = 0.5; // SOL
 
 export function TradingAgentFundingBar({
   currentBalance,
   threshold = FUNDING_THRESHOLD,
   status,
   showLabel = true,
   compact = false,
 }: TradingAgentFundingBarProps) {
   const progress = Math.min(100, (currentBalance / threshold) * 100);
   const isFunded = currentBalance >= threshold;
   const isActive = status === "active";
   const isPaused = status === "paused";
 
   // Determine visual state
   const getStatusConfig = () => {
     if (isActive) {
       return {
         icon: CheckCircle2,
         label: "Trading Active",
         sublabel: `${currentBalance.toFixed(4)} SOL capital`,
         barColor: "bg-green-500",
         textColor: "text-green-400",
         bgColor: "bg-green-500/10",
         borderColor: "border-green-500/30",
       };
     }
     if (isPaused) {
       return {
         icon: PauseCircle,
         label: "Trading Paused",
         sublabel: `${currentBalance.toFixed(4)} / ${threshold} SOL`,
         barColor: "bg-muted-foreground",
         textColor: "text-muted-foreground",
         bgColor: "bg-muted/30",
         borderColor: "border-muted",
       };
     }
     if (isFunded) {
       return {
         icon: Loader2,
         label: "Activating...",
         sublabel: `${currentBalance.toFixed(4)} SOL ready`,
         barColor: "bg-green-500",
         textColor: "text-green-400",
         bgColor: "bg-green-500/10",
         borderColor: "border-green-500/30",
         iconSpin: true,
       };
     }
     return {
       icon: Zap,
       label: "Accumulating Fees",
       sublabel: `${currentBalance.toFixed(4)} / ${threshold} SOL`,
       barColor: "bg-amber-500",
       textColor: "text-amber-400",
       bgColor: "bg-amber-500/10",
       borderColor: "border-amber-500/30",
     };
   };
 
   const config = getStatusConfig();
   const Icon = config.icon;
 
   if (compact) {
     return (
       <div className="space-y-1.5">
         <div className="flex items-center justify-between text-xs">
           <div className={cn("flex items-center gap-1", config.textColor)}>
             <Icon className={cn("h-3 w-3", config.iconSpin && "animate-spin")} />
             <span>{config.label}</span>
           </div>
           <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
         </div>
         <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
           <div
             className={cn("h-full rounded-full transition-all duration-500", config.barColor)}
             style={{ width: `${progress}%` }}
           />
         </div>
       </div>
     );
   }
 
   return (
     <div className={cn("rounded-lg p-4 border", config.bgColor, config.borderColor)}>
       {showLabel && (
         <div className="flex items-center justify-between mb-3">
           <div className={cn("flex items-center gap-2", config.textColor)}>
             <Icon className={cn("h-4 w-4", config.iconSpin && "animate-spin")} />
             <span className="font-medium">{config.label}</span>
           </div>
           <span className="text-sm font-mono">{progress.toFixed(1)}%</span>
         </div>
       )}
       <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
         <div
           className={cn("h-full rounded-full transition-all duration-500", config.barColor)}
           style={{ width: `${progress}%` }}
         />
       </div>
       <div className="flex items-center justify-between text-xs text-muted-foreground">
         <span>{config.sublabel}</span>
         {!isActive && !isPaused && (
           <span>Trading starts at {threshold} SOL</span>
         )}
       </div>
     </div>
   );
 }