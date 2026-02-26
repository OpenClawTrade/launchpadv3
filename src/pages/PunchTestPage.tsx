import { useState, useRef, useEffect } from "react";

const STEPS = 18;
const MOVE_PX = 10;

const PunchTestPage = () => {
  const [step, setStep] = useState(0);
  const [won, setWon] = useState(false);
  const lastClickRef = useRef(Date.now());

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

  // Hide any app-level chrome
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = "#000";
    return () => {
      document.body.style.overflow = "";
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.body.style.background = "";
    };
  }, []);

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
        cursor: won ? "default" : "pointer",
      }}
    >
      {/* Scene */}
      <div
        style={{
          position: "relative",
          width: "72vw",
          maxWidth: 720,
          marginRight: "2vw",
          marginTop: "-18vh",
          transform: "rotate(-7deg)",
          zIndex: 4,
          opacity: won ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
      >
        <img src="/images/punch-branch.png" alt="" style={{ width: "100%", pointerEvents: "none" }} draggable={false} />
        <img
          src="/images/punch-plush.png"
          alt=""
          style={{
            position: "absolute",
            left: "18%",
            top: "23%",
            width: "50%",
            pointerEvents: "none",
            transform: `translate(${step * MOVE_PX}px, ${step * 3}px) rotate(5deg)`,
          }}
          draggable={false}
        />
      </div>

      <img
        src="/images/punch-baby-monkey.png"
        alt=""
        style={{
          position: "absolute",
          right: "calc(50% - 33vw)",
          bottom: "calc(50% - 32vw)",
          width: "30vw",
          maxWidth: 420,
          zIndex: 2,
          pointerEvents: "none",
          opacity: won ? 0 : 1,
          transition: "opacity 600ms ease-in-out",
          filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
        }}
        draggable={false}
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
          pointerEvents: won ? "auto" : "none",
          transition: "opacity 600ms ease-in-out",
        }}
      >
        <img
          src="/images/punch-monkey-hug.png"
          alt=""
          style={{
            maxWidth: "80vw",
            maxHeight: "80vh",
            objectFit: "contain" as const,
            filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default PunchTestPage;
