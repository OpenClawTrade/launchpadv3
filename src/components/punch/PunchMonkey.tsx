import { useRef, useEffect } from "react";

interface PunchMonkeyProps {
  onTap: (x: number, y: number) => void;
  tapping: boolean;
  completed: boolean;
  progress: number; // 0-100
}

export function PunchMonkey({ onTap, tapping, completed, progress }: PunchMonkeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map progress 0-100 to step 0-18
  const step = Math.round((progress / 100) * 18);

  const handleInteraction = (clientX: number, clientY: number) => {
    if (completed) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    onTap(x, y);
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none cursor-pointer active:cursor-grabbing"
      style={{
        width: "72vw",
        maxWidth: "720px",
        height: "60vw",
        maxHeight: "600px",
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
      {/* Branch + Toy wrapper */}
      <div
        className="absolute transition-opacity duration-[600ms] ease-in-out"
        style={{
          top: "50%",
          left: "50%",
          width: "72vw",
          maxWidth: "720px",
          transform: "translate(-50%, -50%) rotate(-7deg)",
          marginRight: "2vw",
          marginTop: "-10vh",
          zIndex: 4,
          opacity: completed ? 0 : 1,
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
      >
        {/* Branch */}
        <img
          src="/images/punch-branch.png"
          alt=""
          className="w-full pointer-events-none"
          draggable={false}
        />

        {/* Toy sliding along the branch */}
        <img
          src="/images/punch-plush.png"
          alt="Plush monkey"
          className="absolute pointer-events-none transition-transform duration-100 ease-out"
          style={{
            left: "18%",
            top: "23%",
            width: "50%",
            transform: `translate(${step * 10}px, ${step * 3}px) rotate(5deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Baby monkey — bottom right, reaching up */}
      <img
        src="/images/punch-baby-monkey.png"
        alt="Baby monkey"
        className={`absolute pointer-events-none transition-all duration-[600ms] ease-in-out ${
          !completed && (tapping ? "scale-90" : "animate-idle-bob")
        }`}
        style={{
          right: "calc(50% - 33vw)",
          bottom: "calc(50% - 32vw)",
          width: "30vw",
          maxWidth: "420px",
          zIndex: 2,
          opacity: completed ? 0 : 1,
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
        draggable={false}
      />

      {/* Final hug image */}
      <div
        className="absolute inset-0 grid place-items-center transition-opacity duration-[600ms] ease-in-out"
        style={{
          zIndex: 10,
          opacity: completed ? 1 : 0,
          pointerEvents: completed ? "auto" : "none",
        }}
      >
        <img
          src="/images/punch-monkey-hug.png"
          alt="Monkey hug!"
          style={{
            maxWidth: "80vw",
            maxHeight: "80vh",
            objectFit: "contain",
            filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
          }}
          draggable={false}
        />
      </div>

      {/* Impact burst */}
      {tapping && !completed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-32 h-32 rounded-full animate-punch-burst" />
        </div>
      )}
    </div>
  );
}
