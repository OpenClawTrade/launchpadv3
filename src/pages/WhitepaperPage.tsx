import { Card } from "@/components/ui/card";
import { FileText, Rocket, Shield, Flame, Coins, Lock, Percent, Wallet } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MatrixContentCard } from "@/components/layout/MatrixContentCard";
import { AppHeader } from "@/components/layout/AppHeader";
import { useState } from "react";
import { BRAND } from "@/config/branding";

export default function WhitepaperPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <MatrixContentCard>
            {/* Title */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm mb-6">
                <FileText className="h-4 w-4" />
                Documentation
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                {BRAND.name} — Ethereum Launchpad
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-[90%] mx-auto">
                A klik.finance-style ERC-20 launcher with Uniswap V3 liquidity, optional LP burn, and a creator-friendly fee refund model.
              </p>
            </div>

            {/* TOC */}
            <Card className="p-6 mb-8 bg-card/50">
              <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
              <nav className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: "overview", title: "1. Overview" },
                  { id: "how-it-works", title: "2. How a Launch Works" },
                  { id: "lp-config", title: "3. LP Configuration" },
                  { id: "fees", title: "4. Trading Fees & Tax" },
                  { id: "refund", title: "5. LP Refund Guarantee" },
                  { id: "security", title: "6. Security Options" },
                  { id: "bnb", title: "7. BNB Chain Launchpad" },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </Card>

            <div className="space-y-12">
              {/* 1. Overview */}
              <section id="overview">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6 flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" /> 1. Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {BRAND.name} is an EVM-only launchpad focused on <strong className="text-foreground">Ethereum</strong> and <strong className="text-foreground">BNB Chain</strong>. The Ethereum flow is modeled after klik.finance: pick how much ETH to seed in the pool, set your trading tax, deploy, and instantly trade on Uniswap V3.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Every launch is permissionless. Token metadata (name, symbol, description, socials) is encoded into the contract header as a comment so that anyone reading the bytecode can verify the token was launched through {BRAND.name}.
                </p>
              </section>

              {/* 2. How a launch works */}
              <section id="how-it-works">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  2. How a Launch Works
                </h2>
                <ol className="space-y-3 text-muted-foreground list-decimal list-inside">
                  <li><strong className="text-foreground">Connect wallet</strong> on Ethereum mainnet.</li>
                  <li><strong className="text-foreground">Enter metadata</strong> — name, ticker, description, image, Twitter, website, Telegram.</li>
                  <li><strong className="text-foreground">Choose LP size</strong> — 0.5, 1, 3, 5 ETH preset, or a custom amount.</li>
                  <li><strong className="text-foreground">Set your trading tax</strong> — 0% to 3% (platform always adds a flat 1% on top).</li>
                  <li><strong className="text-foreground">Pick security options</strong> — burn LP forever and/or renounce ownership.</li>
                  <li><strong className="text-foreground">Deploy</strong> — contract is created, liquidity added to Uniswap V3, trading enabled in the same transaction batch.</li>
                </ol>
              </section>

              {/* 3. LP Config */}
              <section id="lp-config">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6 flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" /> 3. LP Configuration
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You decide how much ETH seeds the initial Uniswap V3 pool. Bigger LP means lower slippage and a higher initial market cap.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: "Preset", value: "0.5 / 1 / 3 / 5 ETH" },
                    { label: "Custom", value: "Any amount you choose" },
                    { label: "Pool", value: "Uniswap V3 (ETH pair)" },
                    { label: "Pair", value: "TOKEN / WETH" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-2 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Fees */}
              <section id="fees">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6 flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" /> 4. Trading Fees & Tax
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Every swap on the launched token is taxed. The creator picks how much they want to earn; {BRAND.name} always takes a fixed 1% on top.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">Creator Tax</th>
                        <th className="text-left py-2 px-2 text-foreground">Platform Fee</th>
                        <th className="text-left py-2 px-2 text-foreground">Total Swap Tax</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50"><td className="py-2 px-2">0%</td><td className="py-2 px-2">1%</td><td className="py-2 px-2 text-foreground">1% (minimum)</td></tr>
                      <tr className="border-b border-border/50"><td className="py-2 px-2">0.5%</td><td className="py-2 px-2">1%</td><td className="py-2 px-2 text-foreground">1.5%</td></tr>
                      <tr className="border-b border-border/50"><td className="py-2 px-2">1%</td><td className="py-2 px-2">1%</td><td className="py-2 px-2 text-foreground">2%</td></tr>
                      <tr className="border-b border-border/50"><td className="py-2 px-2">2%</td><td className="py-2 px-2">1%</td><td className="py-2 px-2 text-foreground">3%</td></tr>
                      <tr><td className="py-2 px-2">3% (max)</td><td className="py-2 px-2">1%</td><td className="py-2 px-2 text-foreground">4% (maximum)</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Maximum creator tax is capped at 3% — the contract enforces this so the swap tax can never exceed 4%.
                </p>
              </section>

              {/* 5. Refund */}
              <section id="refund">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> 5. LP Refund Guarantee
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To make launching risk-free, {BRAND.name} returns the creator&apos;s seeded LP from the very first platform fees collected.
                </p>
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <p className="text-sm text-foreground">
                    The first ETH the platform earns from its 1% fee on your token is sent <strong>back to you</strong> until you have recovered the full LP amount you contributed.
                  </p>
                </Card>
                <p className="text-muted-foreground leading-relaxed mt-4 text-sm">
                  Example: you launch with 1 ETH in LP and burn it. As trades happen, the platform&apos;s 1% fee accrues. The first 1 ETH worth of those fees is automatically streamed back to your wallet — even if your LP is permanently locked.
                </p>
              </section>

              {/* 6. Security */}
              <section id="security">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> 6. Security Options
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card className="p-4 bg-card/50">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" /> Burn LP Forever
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Your Uniswap V3 LP NFT is sent to the dead address (<code>0x000…dEaD</code>) immediately after liquidity is seeded. Liquidity can never be pulled.
                    </p>
                  </Card>
                  <Card className="p-4 bg-card/50">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Renounce Contract
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">
                      Ownership is transferred to the zero address right after launch. No one — including the deployer — can modify the contract afterwards.
                    </p>
                  </Card>
                </div>
              </section>

              {/* 7. BNB */}
              <section id="bnb">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  7. BNB Chain Launchpad
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Alongside Ethereum, {BRAND.name} runs a BNB Chain bonding-curve launchpad. Tokens trade on a Saturn-managed bonding curve and graduate to PancakeSwap when the threshold is reached.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: "Total Supply", value: "1,000,000,000" },
                    { label: "Graduation", value: "~16 BNB" },
                    { label: "Standard", value: "BEP-20" },
                    { label: "Post-Graduation", value: "PancakeSwap" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-2 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </MatrixContentCard>
        </main>
      </div>
    </div>
  );
}
