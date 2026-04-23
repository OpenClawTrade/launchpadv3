/**
 * PopshibaAlphaPage — Live trade feed
 * Renders the canonical Popshiba `alpha.html` template inside an iframe.
 * The iframe template ships with its own matching header + footer, so we
 * intentionally do NOT wrap this in LaunchpadLayout (would double the chrome).
 */
import { useRef } from "react";

export default function PopshibaAlphaPage() {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={ref}
      src="/popshiba-template/alpha.html"
      title="Popshiba Alpha"
      className="block w-full border-0"
      style={{ height: "100vh", background: "#f5a524" }}
    />
  );
}
