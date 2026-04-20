import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

export function BarkLoudCloser() {
  return (
    <section className="relative bg-pop-orange text-pop-ink overflow-hidden py-12 sm:py-16 lg:py-24">
      {/* faint POP POP POP repeated background */}
      <div className="absolute inset-x-0 top-4 text-center pointer-events-none select-none overflow-hidden whitespace-nowrap">
        <span className="font-pop-display text-[60px] sm:text-[100px] lg:text-[120px] tracking-[-0.04em] text-pop-ink/[0.07] leading-none">
          POP · POP · POP · POP · POP · POP · POP · POP
        </span>
      </div>

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-7 text-center">
        <h2 className="font-pop-display text-[2.25rem] xs:text-[2.75rem] sm:text-[4rem] md:text-[5rem] lg:text-[6.5rem] leading-[0.92] tracking-[-0.03em]">
          Bark loud.<br />
          Pop <span className="underline decoration-pop-ink decoration-[4px] sm:decoration-[6px] underline-offset-[6px] sm:underline-offset-[10px]">harder.</span>
        </h2>
        <p className="text-pop-ink/85 text-[14px] sm:text-[16px] md:text-[18px] max-w-xl mx-auto mt-5 sm:mt-6 leading-snug px-2">
          Launch a token in 60 seconds. Zero presale, zero team alloc, 100% fair.<br className="hidden sm:block" />
          <span className="sm:hidden"> </span>The Ethereum szn starts now.
        </p>
        <Link
          to="/launch"
          className="inline-flex items-center gap-2 mt-6 sm:mt-8 px-5 sm:px-7 py-3 sm:py-4 bg-pop-ink text-pop-cream border-2 border-pop-ink font-bold text-[13px] sm:text-[15px] shadow-[4px_4px_0_hsl(var(--pop-cream))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-cream))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--pop-cream))] transition-all"
        >
          <Rocket className="w-4 h-4" /> Launch your token →
        </Link>
      </div>
    </section>
  );
}
