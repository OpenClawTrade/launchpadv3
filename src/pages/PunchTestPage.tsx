import { useState, useRef, useEffect } from "react";

const STEPS = 18;

const PunchTestPage = () => {
  const [step, setStep] = useState(0);
  const [won, setWon] = useState(false);
  const lastClickRef = useRef<number>(Date.now());

  // Responsive move amount based on viewport width
  const getMovePx = () => Math.max(4, Math.min(10, window.innerWidth / 100));
  const getMoveY = () => Math.max(1.5, Math.min(3, window.innerWidth / 200));

  useEffect(() => {
    const interval = setInterval(() => {
      if (!won && Date.now() - lastClickRef.current > 200) {
        setStep((prev) => Math.max(prev - 1, 0));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [won]);

  useEffect(() => {
    if (step >= STEPS && !won) {
      setWon(true);
    }
  }, [step, won]);

  const movePx = getMovePx();
  const moveY = getMoveY();

  return (
    <div
      onClick={() => {
        if (won) return;
        lastClickRef.current = Date.now();
        setStep((prev) => Math.min(prev + 1, STEPS));
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        margin: 0,
        padding: 0,
      }}
    >
      {/* Scene */}
      <div
        style={{
          position: "relative",
          marginRight: "2vw",
          marginTop: "-12vh",
          width: "min(72vw, 720px)",
          transform: "rotate(-7deg)",
          zIndex: 4,
          opacity: won ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          pointerEvents: won ? "none" : undefined,
        }}
      >
        <img
          src="/branch.png"
          alt="branch"
          style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.08))" }}
        />
        <img
          src="/toy.png"
          alt="toy"
          style={{
            position: "absolute",
            left: "18%",
            top: "23%",
            width: "50%",
            height: "auto",
            zIndex: 6,
            transform: `translate(${step * movePx}px, ${step * moveY}px) rotate(5deg)`,
            filter: "drop-shadow(0 6px 12px rgba(255,255,255,0.1))",
          }}
        />
      </div>
      <img
        src="/monkey.png"
        alt="Monkey"
        style={{
          position: "absolute",
          width: "min(30vw, 420px)",
          height: "auto",
          zIndex: 2,
          filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.1))",
          right: "calc(50% - 33vw)",
          bottom: "calc(50% - 28vw)",
          opacity: won ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          pointerEvents: won ? "none" : undefined,
        }}
      />
      {/* Final image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          zIndex: 10,
          opacity: won ? 1 : 0,
          transition: "opacity 600ms ease-in-out",
          pointerEvents: won ? undefined : "none",
        }}
      >
        <img
          src="/final.png"
          alt="Victory"
          style={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
};

export default PunchTestPage;
