/**
 * PopshibaXTrackerPage — KOL X feed
 * Renders the canonical Popshiba `x-tracker.html` template inside an iframe,
 * wrapped in LaunchpadLayout so it shares the same header + footer as
 * every other page.
 */
import { useRef } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

export default function PopshibaXTrackerPage() {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <LaunchpadLayout noPadding>
      <iframe
        ref={ref}
        src="/popshiba-template/x-tracker.html"
        title="Popshiba X Tracker"
        className="block w-full border-0"
        style={{ height: "calc(100vh - 56px)", background: "#f5a524" }}
      />
    </LaunchpadLayout>
  );
}
