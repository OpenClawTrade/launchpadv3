import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
}

export function LaunchpadLayout({ children }: LaunchpadLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[160px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 pb-14">
          {children}
        </main>
        <Footer />
      </div>
      
    </div>
  );
}
