export function MarqueeTicker() {
  const items = [
    { label: "$POPSHIBA", value: "LIVE", accent: true },
    { label: "LAUNCH / HODL / POP" },
    { label: "$PUNK", value: "+1500%", up: true },
    { label: "ETHEREUM SZN" },
    { label: "$LAIKA", value: "+113%", up: true },
    { label: "$GENESIS", value: "+24.3%", up: true },
    { label: "$MILADY", value: "+22.5%", up: true },
  ];
  // duplicate for seamless loop
  const track = [...items, ...items, ...items];
  return (
    <div className="bg-pop-ink text-pop-cream overflow-hidden border-b-[3px] border-pop-orange font-pop-mono text-[12px] tracking-[0.1em]">
      <div
        className="inline-flex gap-8 py-2.5 whitespace-nowrap"
        style={{ animation: "popshiba-ticker 45s linear infinite" }}
      >
        {track.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2.5">
            <span className={it.accent ? "text-pop-orange font-bold" : ""}>
              {it.label}
            </span>
            {it.value && (
              <span className={it.up ? "text-emerald-400 font-bold" : "text-pop-cream/60"}>
                {it.value}
              </span>
            )}
            <span className="text-pop-cream/40">·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes popshiba-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
