import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";

const VIDEO_SRC = "/videos/punch-stream-1.mp4";
const SHOWN_ROUTES = ["/punch-test"];

export function PunchVideoPopup({ onVideoClick }: { onVideoClick?: () => void }) {
  const { pathname } = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("punch-video-dismissed") === "1"
  );

  const visible = !dismissed && SHOWN_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 z-50 cursor-pointer group w-[80px] h-[80px] md:w-[130px] md:h-[130px]"
      style={{ bottom: 100 }}
      onClick={() => onVideoClick?.()}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-border shadow-lg bg-black">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
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

        {/* Close button */}
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
