/**
 * PopshibaLaunchpadPage
 * 1:1 port of popshiba-site/launch.html (the "Popshiba — Launch your coin" page).
 *
 * STATUS: Commit #1 — shell + routing only. Sections will be ported in
 * subsequent commits (hero, create form, live launches, graduated, footer).
 *
 * Source files (in user zip):
 *   - popshiba-site/launch.html       → THIS PAGE (1353 lines)
 *   - popshiba-site/landing-v2-standalone.html → kept for marketing landing later
 */

export default function PopshibaLaunchpadPage() {
  return (
    <div
      className="min-h-screen font-pop-body text-pop-ink"
      style={{ background: "hsl(var(--pop-orange))" }}
    >
      {/* Phase 0 placeholder — visual sections land in commit #2 */}
      <div className="max-w-[1440px] mx-auto px-7 py-10">
        <div
          className="border-2 border-pop-ink bg-pop-cream p-10 text-center"
          style={{ boxShadow: "6px 6px 0 hsl(var(--pop-ink))" }}
        >
          <h1 className="font-pop-display text-4xl mb-3">
            Popshiba Launchpad — porting in progress
          </h1>
          <p className="font-pop-mono text-xs tracking-widest uppercase opacity-70">
            commit #1 / 5 · routing live · sections incoming
          </p>
          <p className="mt-4 text-sm">
            The previous landing is preserved at{" "}
            <a className="underline font-bold" href="/preview-old">
              /preview-old
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
