import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightSidebar } from "./RightSidebar";
import { MobileNav } from "./MobileNav";

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
    <div className="min-h-screen bg-background flex justify-center">
      <div className="flex w-full max-w-8xl">
        {/* Left Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar user={user} />
        </div>

        {/* Main Content */}
        <main className="flex-1 min-h-screen border-r border-border max-w-[600px] pb-20 md:pb-0">
          {children}
        </main>

        {/* Right Sidebar - Hidden on smaller screens */}
        {!hideRightSidebar && <RightSidebar />}
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
