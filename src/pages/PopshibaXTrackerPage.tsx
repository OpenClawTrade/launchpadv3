/**
 * PopshibaXTrackerPage — KOL X feed
 * Renders the canonical Popshiba `x-tracker.html` template inside an iframe
 * to guarantee 1:1 fidelity with the design source.
 */
import { useRef } from "react";

export default function PopshibaXTrackerPage() {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={ref}
      src="/popshiba-template/x-tracker.html"
      title="Popshiba X Tracker"
      className="block w-full border-0"
      style={{ height: "100vh", background: "#f5a524" }}
    />
  );
}
