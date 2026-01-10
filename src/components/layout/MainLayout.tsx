import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "./RightSidebar";
import { MobileNav, MobileHeader } from "./MobileNav";

export interface MainLayoutProps {
  children: ReactNode;
  user?: {
    name: string;
    handle: string;
    avatar?: string;
  } | null;
  hideRightSidebar?: boolean;
}

export function MainLayout({ children, user, hideRightSidebar }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header - Only visible on mobile */}
      <MobileHeader user={user} />

      {/* Centered container for desktop */}
      <div className="mx-auto flex max-w-[1280px] justify-center">
        {/* Left Sidebar - Hidden on mobile */}
        <div className="hidden md:flex md:flex-shrink-0">
          <Sidebar user={user} />
        </div>

        {/* Main Content - Full width on mobile, fixed on desktop */}
        <main className="min-h-screen w-full border-x border-border md:w-[600px] md:max-w-[600px] md:flex-shrink-0 pb-20 md:pb-0">
          {children}
        </main>

        {/* Right Sidebar - Hidden on smaller screens */}
        {!hideRightSidebar && (
          <div className="hidden lg:flex lg:flex-shrink-0">
            <RightSidebar />
          </div>
        )}
      </div>

      {/* Mobile Navigation - Fixed at bottom */}
      <MobileNav />
    </div>
  );
}
