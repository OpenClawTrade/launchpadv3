import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TunaBookLayoutProps {
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TunaBookLayout({
  leftSidebar,
  rightSidebar,
  children,
  className,
}: TunaBookLayoutProps) {
  return (
    <div className={cn("tunabook-theme min-h-screen bg-[hsl(var(--tunabook-bg-primary))]", className)}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - hidden on mobile */}
          {leftSidebar && (
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20">{leftSidebar}</div>
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>

          {/* Right Sidebar - hidden on mobile and tablet */}
          {rightSidebar && (
            <aside className="hidden xl:block w-80 flex-shrink-0">
              <div className="sticky top-20">{rightSidebar}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
