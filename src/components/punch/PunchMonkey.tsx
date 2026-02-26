import { useRef, useEffect } from "react";

interface PunchMonkeyProps {
  onTap: (x: number, y: number) => void;
  tapping: boolean;
  completed: boolean;
  progress: number; // 0-100
}

export function PunchMonkey({ onTap, tapping, completed, progress }: PunchMonkeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ripplesRef = useRef<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      ripplesRef.current = ripplesRef.current.filter(
        (r) => Date.now() - r.id < 600
      );
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const handleInteraction = (clientX: number, clientY: number) => {
    if (completed) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    onTap(x, y);
    ripplesRef.current.push({ id: Date.now(), x, y });
  };

  // Plush slides from top of branch down toward baby monkey's hand
  const t = Math.min(progress / 100, 1);
  // Start: near top-left on the branch; End: near bottom-right toward baby
  const plushX = 15 + t * 35;  // 15% → 50% from left
  const plushY = 20 + t * 45;  // 20% → 65% from top

  return (
    <div
      ref={containerRef}
      className="relative select-none cursor-pointer active:cursor-grabbing"
      style={{
        width: "340px",
        height: "380px",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        handleInteraction(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleInteraction(touch.clientX, touch.clientY);
      }}
    >
      {/* Scene: branch + plush sliding + baby monkey */}
      {!completed && (
        <>
          {/* Branch — angled from upper-left to center-right */}
          <img
            src="/images/punch-branch.png"
            alt=""
            className="absolute pointer-events-none z-10"
            style={{
              top: "5%",
              left: "-5%",
              width: "90%",
              transform: "rotate(-12deg)",
              transformOrigin: "center center",
            }}
            draggable={false}
          />

          {/* Plush monkey sliding down the branch */}
          <img
            src="/images/punch-plush.png"
            alt="Plush monkey"
            className="absolute pointer-events-none z-20 transition-all duration-150 ease-out"
            style={{
              width: "80px",
              left: `${plushX}%`,
              top: `${plushY}%`,
              transform: "translate(-50%, -50%) rotate(-5deg)",
            }}
            draggable={false}
          />

          {/* Baby monkey — bottom right, reaching up */}
          <img
            src="/images/punch-baby-monkey.png"
            alt="Baby monkey"
            className={`absolute pointer-events-none z-10 ${
              tapping ? "scale-90" : "animate-idle-bob"
            } transition-transform duration-75`}
            style={{
              width: "130px",
              bottom: "0",
              right: "0",
            }}
            draggable={false}
          />
        </>
      )}

      {/* Completion: hug image */}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center z-30 animate-monkey-celebrate">
          <img
            src="/images/punch-monkey-hug.png"
            alt="Monkey hug!"
            className="w-56 sm:w-64 h-auto drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
            draggable={false}
          />
        </div>
      )}

      {/* Impact burst */}
      {tapping && !completed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-32 h-32 rounded-full animate-punch-burst" />
        </div>
      )}

      {/* Tap ripples */}
      {ripplesRef.current.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none animate-ripple z-40"
          style={{
            left: ripple.x - 20,
            top: ripple.y - 20,
            width: 40,
            height: 40,
          }}
        />
      ))}
    </div>
  );
}
