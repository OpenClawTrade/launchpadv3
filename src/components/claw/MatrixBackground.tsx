import { useEffect, useRef } from "react";

export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const fontSize = 18;
    let columns: number;
    let drops: number[];

    const katakana = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const digits = "0123456789";
    const lobster = "🦞";
    const chars = katakana + digits;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      columns = Math.floor(canvas!.width / fontSize);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
    }

    resize();
    window.addEventListener("resize", resize);

    let lastTime = 0;
    const frameInterval = 80; // ~12fps for slower rain

    function draw(timestamp: number) {
      if (timestamp - lastTime < frameInterval) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastTime = timestamp;
      ctx!.fillStyle = "rgba(10, 10, 15, 0.04)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < columns; i++) {
        // 3% chance of lobster emoji
        const isLobster = Math.random() < 0.03;
        const char = isLobster
          ? lobster
          : chars[Math.floor(Math.random() * chars.length)];

        const x = i * fontSize;
        const y = drops[i] * fontSize;

        if (isLobster) {
          ctx!.font = `${fontSize - 2}px serif`;
          ctx!.fillStyle = `rgba(239, 68, 68, ${0.4 + Math.random() * 0.4})`;
        } else {
          ctx!.font = `${fontSize}px monospace`;
          const brightness = 0.15 + Math.random() * 0.25;
          ctx!.fillStyle = `rgba(0, 255, 65, ${brightness})`;
        }

        ctx!.fillText(char, x, y);
        drops[i]++;

        if (drops[i] * fontSize > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    />
  );
}
