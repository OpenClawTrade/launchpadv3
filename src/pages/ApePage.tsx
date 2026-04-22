/**
 * ApePage — Trade terminal
 * Renders the canonical Popshiba `trade.html` template (1132 lines) inside
 * an iframe to guarantee a 1:1 visual match with the design source.
 * Live data wiring (chart, swap, trades) is bridged via window.postMessage
 * in a follow-up pass.
 */
import { useRef } from "react";

export default function ApePage() {
  const ref = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={ref}
      src="/popshiba-template/trade.html"
      title="Popshiba Trade"
      className="block w-full border-0"
      style={{ height: "100vh", background: "#f5a524" }}
    />
  );
}
