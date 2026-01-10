import { Progress } from "@/components/ui/progress";
import { Zap, Rocket } from "lucide-react";

interface BondingCurveProgressProps {
  progress: number;
  realSolReserves: number;
  graduationThreshold: number;
  className?: string;
  showDetails?: boolean;
}

export function BondingCurveProgress({
  progress,
  realSolReserves,
  graduationThreshold,
  className = "",
  showDetails = true,
}: BondingCurveProgressProps) {
  const isNearGraduation = progress >= 85;
  const isGraduated = progress >= 100;

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
        <span className={`font-bold ${isNearGraduation ? 'text-primary' : 'text-muted-foreground'}`}>
          {progress.toFixed(1)}%
        </span>
      </div>
      
      <div className="relative">
        <Progress 
          value={Math.min(progress, 100)} 
          className={`h-3 ${isNearGraduation ? 'glow-yellow' : ''}`}
        />
        {isNearGraduation && !isGraduated && (
          <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full animate-pulse flex items-center justify-center">
            <Rocket className="h-3 w-3 text-primary-foreground" />
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
