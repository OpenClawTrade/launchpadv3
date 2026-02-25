import { useRef, useEffect } from "react";

interface PunchMonkeyProps {
  onTap: (x: number, y: number) => void;
  tapping: boolean;
  completed: boolean;
}

export function PunchMonkey({ onTap, tapping, completed }: PunchMonkeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ripplesRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);

  // Clear ripples after animation
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
    // Add ripple
    ripplesRef.current.push({ id: Date.now(), x, y });
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none cursor-pointer active:cursor-grabbing transition-transform duration-75 ${
        completed ? "animate-rocket-launch" : ""
      }`}
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
      {/* Monkey emoji as placeholder - visually punchy */}
      <div
        className={`w-48 h-48 sm:w-56 sm:h-56 rounded-3xl flex items-center justify-center text-8xl sm:text-9xl transition-transform duration-75 ${
          tapping ? "scale-90" : "animate-idle-bob"
        }`}
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent)",
        }}
      >
        🐵
      </div>

      {/* Impact burst */}
      {tapping && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-full animate-punch-burst" />
        </div>
      )}

      {/* Tap ripples */}
      {ripplesRef.current.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none animate-ripple"
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
