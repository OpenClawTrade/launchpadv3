import { useRef } from "react";

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
    onTap(clientX - rect.left, clientY - rect.top);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "72vw",
        maxWidth: "720px",
        height: "60vw",
        maxHeight: "600px",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none" as any,
        cursor: completed ? "default" : "pointer",
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
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "72vw",
          maxWidth: "720px",
          transform: "translate(-50%, -50%) rotate(-7deg)",
          marginRight: "2vw",
          marginTop: "-10vh",
          zIndex: 4,
          opacity: completed ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
      >
        {/* Branch */}
        <img
          src="/images/punch-branch.png"
          alt=""
          style={{ width: "100%", pointerEvents: "none" }}
          draggable={false}
        />

        {/* Toy sliding along the branch */}
        <img
          src="/images/punch-plush.png"
          alt="Plush monkey"
          style={{
            position: "absolute",
            left: "18%",
            top: "23%",
            width: "50%",
            pointerEvents: "none",
            transition: "transform 100ms ease-out",
            transform: `translate(${step * 10}px, ${step * 3}px) rotate(5deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Baby monkey */}
      <img
        src="/images/punch-baby-monkey.png"
        alt="Baby monkey"
        style={{
          position: "absolute",
          right: "calc(50% - 33vw)",
          bottom: "calc(50% - 32vw)",
          width: "30vw",
          maxWidth: "420px",
          zIndex: 2,
          pointerEvents: "none",
          opacity: completed ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
        draggable={false}
      />

      {/* Final hug image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          zIndex: 10,
          opacity: completed ? 1 : 0,
          pointerEvents: completed ? "auto" : "none",
          transition: "opacity 600ms ease-in-out",
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
    </div>
  );
}
