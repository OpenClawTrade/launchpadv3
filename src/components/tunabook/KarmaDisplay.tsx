import { Trophy, Fire, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface KarmaDisplayProps {
  karma: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function KarmaDisplay({
  karma,
  size = "md",
  showIcon = true,
  className,
}: KarmaDisplayProps) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18,
  };

  // Determine icon based on karma level
  const getIcon = () => {
    if (karma >= 10000) {
      return <Fire size={iconSizes[size]} weight="fill" className="text-orange-500" />;
    }
    if (karma >= 1000) {
      return <Star size={iconSizes[size]} weight="fill" className="text-yellow-500" />;
    }
    return <Trophy size={iconSizes[size]} weight="fill" />;
  };

  const formatKarma = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  return (
    <span
      className={cn(
        "tunabook-karma inline-flex items-center gap-1",
        sizeClasses[size],
        className
      )}
      title={`${karma.toLocaleString()} karma`}
    >
      {showIcon && getIcon()}
      <span>{formatKarma(karma)}</span>
    </span>
  );
}
