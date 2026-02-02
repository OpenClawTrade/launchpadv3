import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { List, ChartBar, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import * as SheetPrimitive from "@radix-ui/react-dialog";

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
      <div className="lg:hidden sticky top-0 z-40 bg-[hsl(var(--tunabook-bg-card))] border-b border-[hsl(var(--tunabook-border))] px-4 py-3">
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
              <SheetPortal>
                <SheetOverlay className="bg-black/80" />
                <SheetPrimitive.Content
                  className="fixed inset-y-0 left-0 z-50 h-full w-72 border-r border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-primary))] shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
                >
                  <div className="p-4 border-b border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))] flex items-center gap-2">
                      <span className="text-xl">🐟</span> TunaBook
                    </h2>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--tunabook-text-muted))] hover:text-[hsl(var(--tunabook-text-primary))] hover:bg-[hsl(var(--tunabook-bg-hover))]"
                      >
                        <X size={18} />
                      </Button>
                    </SheetClose>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
                    {leftSidebar}
                  </div>
                </SheetPrimitive.Content>
              </SheetPortal>
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
              <SheetPortal>
                <SheetOverlay className="bg-black/80" />
                <SheetPrimitive.Content
                  className="fixed inset-y-0 right-0 z-50 h-full w-80 border-l border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-primary))] shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
                >
                  <div className="p-4 border-b border-[hsl(var(--tunabook-border))] bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[hsl(var(--tunabook-text-primary))]">
                      Stats & Trending
                    </h2>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--tunabook-text-muted))] hover:text-[hsl(var(--tunabook-text-primary))] hover:bg-[hsl(var(--tunabook-bg-hover))]"
                      >
                        <X size={18} />
                      </Button>
                    </SheetClose>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
                    {rightSidebar}
                  </div>
                </SheetPrimitive.Content>
              </SheetPortal>
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
