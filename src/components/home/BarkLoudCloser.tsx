import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";

export function BarkLoudCloser() {
  return (
    <section className="relative bg-pop-orange text-pop-ink overflow-hidden border-b-[3px] border-pop-ink py-16 sm:py-20 lg:py-[90px] px-4 sm:px-7">
      {/* one-line POP background */}
      <div
        className="absolute top-[18px] left-[-10%] right-[-10%] font-pop-display whitespace-nowrap pointer-events-none select-none z-0 leading-none text-pop-ink/[0.08]"
        style={{ fontSize: "clamp(40px, 8vw, 70px)" }}
      >
        POP · POP · POP · POP · POP · POP · POP · POP
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto text-center">
        <h2
          className="font-pop-display text-pop-ink leading-[0.9] tracking-[-0.04em] mb-4 sm:mb-5"
          style={{ fontSize: "clamp(40px, 8vw, 84px)" }}
        >
          Bark loud.<br />
          Pop{" "}
          <span className="relative inline-block">
            <span className="relative z-10">harder.</span>
            <span className="absolute left-0 right-0 bottom-1.5 h-2.5 bg-pop-cream -z-0" aria-hidden />
          </span>
        </h2>
        <p className="text-[14px] sm:text-[16px] text-[#3a1f14] max-w-xl mx-auto mb-7 sm:mb-8 font-medium">
          Launch a token in 60 seconds. Zero presale, zero team alloc, 100% fair. The Ethereum szn starts now.
        </p>
        <Link
          to="/launch"
          className="inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 bg-pop-ink text-pop-cream border-2 border-pop-ink font-bold text-[14px] sm:text-[15px] shadow-[4px_4px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--pop-ink))] transition-all"
        >
          <Rocket className="w-4 h-4" /> Launch your token →
        </Link>
      </div>
    </section>
  );
}
