import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";

const VIDEOS = [
  "/videos/punch-stream-1.mp4",
  "/videos/punch-stream-2.mp4",
];

const SHOWN_ROUTES = ["/punch-test"];

export function PunchVideoPopup() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("punch-video-dismissed") === "1"
  );

  // Ensure video plays on mount and when index changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleEnded = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % VIDEOS.length);
  }, []);

  if (dismissed || !SHOWN_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <div
      className="fixed left-3 z-50 cursor-pointer group w-[100px] h-[100px] md:w-[130px] md:h-[130px]"
      style={{ bottom: 56 }}
      onClick={() => navigate("/console")}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-border shadow-lg bg-black">
        <video
          ref={videoRef}
          src={VIDEOS[currentIndex]}
          autoPlay
          muted
          loop
          playsInline
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

        {/* Close button — always visible */}
        <button
          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
            sessionStorage.setItem("punch-video-dismissed", "1");
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
