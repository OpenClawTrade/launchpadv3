import { useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";

const VIDEOS = [
  "/videos/punch-stream-1.mp4",
  "/videos/punch-stream-2.mp4",
];

const HIDDEN_ROUTES = ["/console", "/punch", "/punch-test"];

export function PunchVideoPopup() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("punch-video-dismissed") === "1"
  );

  const handleEnded = useCallback(() => {
    const next = (currentIndex + 1) % VIDEOS.length;
    setCurrentIndex(next);
    if (videoRef.current) {
      videoRef.current.src = VIDEOS[next];
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  if (dismissed || HIDDEN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 cursor-pointer group w-[120px] h-[120px] md:w-[160px] md:h-[160px]"
      onClick={() => navigate("/console")}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-border shadow-lg bg-black">
        <video
          ref={videoRef}
          src={VIDEOS[currentIndex]}
          autoPlay
          muted
          playsInline
          onEnded={handleEnded}
          className="w-full h-full object-cover"
        />

        {/* LIVE badge */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600 px-1.5 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider shadow">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
          Live
        </div>

        {/* Close button */}
        <button
          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
            sessionStorage.setItem("punch-video-dismissed", "1");
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
