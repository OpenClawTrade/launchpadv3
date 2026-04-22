/**
 * PopshibaAlphaPage — Live trade feed
 * Renders the canonical Popshiba `alpha.html` template inside an iframe
 * to guarantee 1:1 fidelity with the design source.
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
