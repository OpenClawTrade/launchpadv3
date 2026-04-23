/**
 * PopshibaAlphaPage — Live trade feed
 * Uses the shared app chrome so the header/footer are identical to the main page.
 */
import { useRef } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

export default function PopshibaAlphaPage() {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <LaunchpadLayout noPadding>
      <iframe
        ref={ref}
        src="/popshiba-template/alpha.html?embed=1"
        title="Popshiba Alpha"
        className="block w-full border-0"
        style={{ height: "calc(100vh - 56px)", background: "#f5a524" }}
      />
    </LaunchpadLayout>
  );
}
