import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Info, TrendingUp, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FeeSliderProps {
  creatorFeePct: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function FeeSlider({ creatorFeePct, onChange, disabled = false }: FeeSliderProps) {
  const buybackPct = 100 - creatorFeePct;

  // Calculate example earnings for $10k daily volume with 1% fee
  const dailyFees = 10000 * 0.01; // $100 in fees
  const creatorDaily = (dailyFees * creatorFeePct) / 100;
  const buybackDaily = (dailyFees * buybackPct) / 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          Fee Distribution
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                1% of all trading volume is collected as fees. You choose how to split it
                between your wallet and automatic token buybacks. This setting is 
                <strong> immutable after launch</strong>.
              </p>
            </TooltipContent>
          </Tooltip>
        </Label>
      </div>

      {/* Visual Split Display */}
      <div className="flex h-8 rounded-lg overflow-hidden border border-border">
        <div 
          className="bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground transition-all duration-300"
          style={{ width: `${creatorFeePct}%` }}
        >
          {creatorFeePct >= 20 && `${creatorFeePct}%`}
        </div>
        <div 
          className="bg-emerald-500/20 flex items-center justify-center text-xs font-medium text-emerald-400 transition-all duration-300"
          style={{ width: `${buybackPct}%` }}
        >
          {buybackPct >= 20 && `${buybackPct}%`}
        </div>
      </div>

      {/* Slider */}
      <Slider
        value={[creatorFeePct]}
        onValueChange={([value]) => onChange(value)}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        className="py-2"
      />

      {/* Labels */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-1.5 text-primary">
          <TrendingUp className="h-4 w-4" />
          <span>Creator: {creatorFeePct}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Users className="h-4 w-4" />
          <span>Buybacks: {buybackPct}%</span>
        </div>
      </div>

      {/* Earnings Example */}
      <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          Example: $10k daily volume (1% fee = $100/day)
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-primary">
            You earn: <strong>${creatorDaily.toFixed(0)}/day</strong>
          </span>
          <span className="text-emerald-400">
            Buybacks: <strong>${buybackDaily.toFixed(0)}/day</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
