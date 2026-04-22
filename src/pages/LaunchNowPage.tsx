import { Helmet } from "react-helmet-async";
import { EthLauncher } from "@/components/launchpad/EthLauncher";
import { Card } from "@/components/ui/card";
import { Rocket, Zap, Shield, CheckCircle2 } from "lucide-react";

/**
 * /launchnow — Simplified, all-in-one ETH launch utility.
 *
 * Wraps the existing EthLauncher (which deploys the token, creates the
 * Uniswap pool, seeds LP and burns/locks the LP — all in a single tx)
 * so users don't have to manually:
 *   1. Write & verify a contract in Remix
 *   2. Add liquidity on Uniswap
 *   3. Call setRule to enable trading
 *   4. Burn LP tokens
 *
 * Everything happens in ONE wallet confirmation.
 */
export default function LaunchNowPage() {
  return (
    <>
      <Helmet>
        <title>Launch Now — 1-Click ETH Token Launch | Popshiba</title>
        <meta
          name="description"
          content="Deploy an ERC-20, create the Uniswap pool, add liquidity and burn/lock LP — all in a single transaction. No Remix, no manual steps."
        />
        <link rel="canonical" href="https://popshiba.com/launchnow" />
      </Helmet>

      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          {/* Hero */}
          <header className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <Zap className="h-3.5 w-3.5" />
              1-Click Launch
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
              Launch Now
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Deploy your ERC-20, create the Uniswap pool, seed liquidity, and burn/lock LP —
              <span className="text-foreground font-semibold"> all in one transaction</span>.
              No Remix. No manual setRule. No copy-pasting addresses.
            </p>
          </header>

          {/* What this replaces */}
          <Card className="bg-card/40 border-border/40 p-5 mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Replaces all of these manual steps
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                "Write Solidity contract in Remix",
                "Compile & deploy via MetaMask",
                "Verify on Etherscan (constructor args)",
                "Find your Uniswap V2 pair address",
                "Approve & supply liquidity on Uniswap",
                "Call setRule with anti-bot params",
                "Send LP tokens to dead address",
                "Submit token info to DexScreener",
              ].map((step) => (
                <div key={step} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* The launcher itself */}
          <section aria-label="Token launcher">
            <EthLauncher />
          </section>

          {/* Footer reassurance */}
          <footer className="mt-10 text-center text-xs text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              Powered by the Popshiba on-chain launcher · Audited contracts · Ethereum Mainnet
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
