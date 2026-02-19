import { useState } from "react";
import { LaunchTokenForm, WalletBalanceCard } from "@/components/launchpad";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

export default function LaunchTokenPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen" style={{ background: "#141414" }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
          <h1 className="text-2xl font-bold text-white mb-2">Launch Token</h1>
          <p className="text-sm mb-6" style={{ color: "#888" }}>Create a coin, raise money, and share with friends.</p>
          <WalletBalanceCard minRequired={0.05} />
          <div className="mt-4">
            <LaunchTokenForm />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
