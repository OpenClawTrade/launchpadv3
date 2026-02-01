import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { List, ChartBar } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--tunabook-bg-primary))]", className)}>
      {/* Mobile Header with menu toggle */}
      <div className="lg:hidden sticky top-0 z-40 bg-[hsl(var(--tunabook-bg-card))/95] backdrop-blur-sm border-b border-[hsl(var(--tunabook-border))] px-4 py-3">
        <div className="flex items-center justify-between">
          {leftSidebar && (
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[hsl(var(--tunabook-text-primary))] hover:bg-[hsl(var(--tunabook-bg-hover))]"
                >
                  <List size={22} weight="bold" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 bg-[hsl(var(--tunabook-bg-card))] border-[hsl(var(--tunabook-border))] p-0"
              >
                <div className="p-4 border-b border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-elevated))]">
                  <h2 className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))] flex items-center gap-2">
                    <span className="text-xl">🐟</span> TunaBook
                  </h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
                  {leftSidebar}
                </div>
              </SheetContent>
            </Sheet>
          )}

          <span className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))] flex items-center gap-2">
            <span className="text-xl">🐟</span> TunaBook
          </span>

          {rightSidebar && (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[hsl(var(--tunabook-text-primary))] hover:bg-[hsl(var(--tunabook-bg-hover))]"
                >
                  <ChartBar size={22} weight="bold" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-80 bg-[hsl(var(--tunabook-bg-card))] border-[hsl(var(--tunabook-border))] p-0"
              >
                <div className="p-4 border-b border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-elevated))]">
                  <h2 className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))]">
                    Stats & Trending
                  </h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
                  {rightSidebar}
                </div>
              </SheetContent>
            </Sheet>
          )}
          
          {!rightSidebar && <div className="w-9" />}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-4 lg:gap-6">
          {/* Left Sidebar - hidden on mobile */}
          {leftSidebar && (
            <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0">
              <div className="sticky top-20">{leftSidebar}</div>
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>

          {/* Right Sidebar - hidden on mobile and tablet */}
          {rightSidebar && (
            <aside className="hidden xl:block w-72 2xl:w-80 flex-shrink-0">
              <div className="sticky top-20">{rightSidebar}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
