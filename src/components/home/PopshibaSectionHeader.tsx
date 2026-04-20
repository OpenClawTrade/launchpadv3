import { cn } from "@/lib/utils";

interface Props {
  eyebrow: string;
  /** Full heading; the part inside [[ ]] gets a cream highlight underline. */
  heading: string;
  sub?: string;
  /** "dark" inverts colors for sections on the dark/ink background. */
  variant?: "light" | "dark";
  className?: string;
}

/** Renders the heading; words wrapped in [[ ]] get a cream/orange under-highlight. */
function renderHeading(heading: string, variant: "light" | "dark") {
  const parts = heading.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("[[") && p.endsWith("]]")) {
      const txt = p.slice(2, -2);
      return (
        <span key={i} className="relative inline-block">
          <span className="relative z-10">{txt}</span>
          <span
            className={cn(
              "absolute left-0 right-0 bottom-1 h-2 -z-0",
              variant === "dark" ? "bg-pop-orange" : "bg-pop-cream"
            )}
            aria-hidden
          />
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function PopshibaSectionHeader({ eyebrow, heading, sub, variant = "light", className }: Props) {
  const isDark = variant === "dark";
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6 mb-8 sm:mb-10", className)}>
      <div className="min-w-0">
        <div
          className={cn(
            "font-pop-mono text-[10px] sm:text-[11px] tracking-[0.18em] sm:tracking-[0.2em] uppercase mb-1.5 sm:mb-2",
            isDark ? "text-pop-orange" : "text-[#3a1f14]"
          )}
        >
          {eyebrow}
        </div>
        <h2
          className={cn(
            "font-pop-display leading-[0.9] tracking-[-0.035em]",
            isDark ? "text-pop-cream" : "text-pop-ink"
          )}
          style={{ fontSize: "clamp(32px, 5vw, 56px)" }}
        >
          {renderHeading(heading, variant)}
        </h2>
      </div>
      {sub && (
        <p
          className={cn(
            "max-w-md text-[13px] sm:text-[14px] leading-[1.5]",
            isDark ? "text-[#a49a8a]" : "text-[#3a1f14]"
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
