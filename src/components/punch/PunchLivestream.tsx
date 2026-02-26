import { useState, useRef, useEffect, useCallback } from "react";

const VIDEOS = [
  "/videos/punch-stream-1.mp4",
  "/videos/punch-stream-2.mp4",
];

export function PunchLivestream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clock, setClock] = useState("");

  // Update clock every second
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleEnded = useCallback(() => {
    const next = (currentIndex + 1) % VIDEOS.length;
    setCurrentIndex(next);
  }, [currentIndex]);

  // When index changes, reload and play
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  return (
    <div className="w-full max-w-[400px] mx-auto mb-4">
      <div className="relative rounded-xl overflow-hidden border-2 border-border shadow-lg bg-black">
        {/* Video */}
        <video
          ref={videoRef}
          src={VIDEOS[currentIndex]}
          autoPlay
          muted
          playsInline
          loop={VIDEOS.length === 1}
          onEnded={VIDEOS.length > 1 ? handleEnded : undefined}
          preload="auto"
          className="w-full aspect-video object-cover"
        />

        {/* Top overlay gradient */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

        {/* LIVE badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded text-[11px] font-black text-white uppercase tracking-wider shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          Live
        </div>

        {/* Timestamp */}
        <div className="absolute top-2.5 right-2.5 font-mono text-[11px] text-white/90 bg-black/50 px-2 py-0.5 rounded shadow" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {clock}
        </div>

        {/* Bottom text overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 py-2.5 pointer-events-none">
          <p className="text-[10px] leading-snug text-white/90 font-medium" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            Hey, I'm Punch. I'm currently busy launching tokens, but you can ask me anything and I'll try to answer 🐵👊
          </p>
        </div>
      </div>
    </div>
  );
}
