import { Progress } from "@/components/ui/progress";
import { Zap, Rocket } from "lucide-react";

interface BondingCurveProgressProps {
  progress?: number;
  realSolReserves: number;
  graduationThreshold: number;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function BondingCurveProgress({
  progress: providedProgress,
  realSolReserves,
  graduationThreshold,
  className = "",
  showDetails = true,
  compact = false,
}: BondingCurveProgressProps) {
  // Calculate progress from reserves if not provided or if it seems incorrect
  const calculatedProgress = graduationThreshold > 0 
    ? (realSolReserves / graduationThreshold) * 100 
    : 0;
  
  // Use calculated progress - it's more reliable than the stored value
  const progress = calculatedProgress;
  
  const isNearGraduation = progress >= 80;
  const isGraduated = progress >= 100;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 relative">
          <Progress 
            value={Math.min(progress, 100)} 
            className={`h-1.5 ${isNearGraduation ? 'glow-yellow' : ''}`}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums ${isNearGraduation ? 'text-primary' : 'text-muted-foreground'}`}>
          {progress.toFixed(0)}%
        </span>
        {isNearGraduation && !isGraduated && (
          <Rocket className="h-3.5 w-3.5 text-primary animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          {isGraduated ? (
            <Rocket className="h-4 w-4 text-primary" />
          ) : (
            <Zap className="h-4 w-4 text-primary" />
          )}
          <span className="font-medium">
            {isGraduated ? "Graduated!" : "Bonding Curve"}
          </span>
        </div>
        <span className={`font-bold tabular-nums ${isNearGraduation ? 'text-primary' : 'text-muted-foreground'}`}>
          {progress.toFixed(1)}%
        </span>
      </div>
      
      <div className="relative">
        <Progress 
          value={Math.min(progress, 100)} 
          className={`h-2.5 ${isNearGraduation ? 'glow-yellow' : ''}`}
        />
        {isNearGraduation && !isGraduated && (
          <div className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-primary rounded-full animate-pulse flex items-center justify-center shadow-lg">
            <Rocket className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        )}
      </div>

      {showDetails && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{realSolReserves.toFixed(2)} SOL raised</span>
          <span>Goal: {graduationThreshold} SOL</span>
        </div>
      )}
    </div>
  );
}
