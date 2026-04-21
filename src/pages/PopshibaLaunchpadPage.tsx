/**
 * PopshibaLaunchpadPage
 * Phase 2 — pixel-perfect 1:1 render of popshiba-site/launch.html via iframe.
 *
 * The static template lives at: /public/popshiba-template/launch.html
 * (originally popshibalaunch-2.zip → popshiba-site/launch.html, 1353 lines)
 *
 * NEXT PHASES:
 *   3 — react-ify Hero + Live Launches sections, wire to ETH `tokens` table
 *   4 — react-ify Create form, wire submit to existing `eth-create-token` fn
 *   5 — react-ify settings + checklist + footer, retire iframe
 *
 * Backup of previous landing: /preview-old
 */

export default function PopshibaLaunchpadPage() {
  return (
    <iframe
      src="/popshiba-template/launch.html"
      title="Popshiba Launchpad"
      className="block w-full border-0"
      style={{ height: "100vh", background: "#f5a524" }}
    />
  );
}
