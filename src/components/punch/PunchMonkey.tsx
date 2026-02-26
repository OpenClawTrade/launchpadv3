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

  // Plush slides from top-left down toward baby monkey
  const t = Math.min(progress / 100, 1);
  const plushX = -30 + t * 60;   // -30% → 30%
  const plushY = -10 + t * 70;   // -10% → 60%

  return (
    <div
      ref={containerRef}
      className="relative select-none cursor-pointer active:cursor-grabbing w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]"
      onMouseDown={(e) => {
        e.preventDefault();
        handleInteraction(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleInteraction(touch.clientX, touch.clientY);
      }}
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Scene: branch + plush sliding + baby monkey */}
      {!completed && (
        <>
          {/* Branch */}
          <img
            src="/images/punch-branch.png"
            alt=""
            className="absolute top-0 left-0 w-full h-auto pointer-events-none z-10"
            style={{ transform: "rotate(-8deg)", transformOrigin: "top left" }}
            draggable={false}
          />

          {/* Plush monkey sliding down */}
          <img
            src="/images/punch-plush.png"
            alt="Plush monkey"
            className="absolute w-24 sm:w-28 pointer-events-none z-20 transition-transform duration-100 ease-out"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(${plushX}%, ${plushY}%) translate(-50%, -50%)`,
            }}
            draggable={false}
          />

          {/* Baby monkey */}
          <img
            src="/images/punch-baby-monkey.png"
            alt="Baby monkey"
            className={`absolute bottom-0 right-0 w-32 sm:w-36 pointer-events-none z-10 ${
              tapping ? "scale-90" : "animate-idle-bob"
            } transition-transform duration-75`}
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
