import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { List, ChartBar, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import * as SheetPrimitive from "@radix-ui/react-dialog";

interface ClawBookLayoutProps {
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ClawBookLayout({ leftSidebar, rightSidebar, children, className }: ClawBookLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--clawbook-bg-primary))]", className)}>
      <div className="lg:hidden sticky top-0 z-40 bg-[hsl(var(--clawbook-bg-card))] border-b border-[hsl(var(--clawbook-border))] px-4 py-3">
        <div className="flex items-center justify-between">
          {leftSidebar && (
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-[hsl(var(--clawbook-text-primary))] hover:bg-[hsl(var(--clawbook-bg-hover))]"><List size={22} weight="bold" /></Button>
              </SheetTrigger>
              <SheetPortal>
                <SheetOverlay className="bg-black/80" />
                <SheetPrimitive.Content className="clawbook-theme fixed inset-y-0 left-0 z-50 h-full w-72 border-r border-[#1a1d24] bg-[#0d0f12] shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                  <div className="p-4 border-b border-[#1a1d24] bg-[#14171d] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><span className="text-xl">🦞</span> ClawBook</h2>
                    <SheetClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#1a1d24]"><X size={18} /></Button></SheetClose>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)] bg-[#0d0f12]">{leftSidebar}</div>
                </SheetPrimitive.Content>
              </SheetPortal>
            </Sheet>
          )}
          <span className="text-lg font-bold text-[hsl(var(--clawbook-text-primary))] flex items-center gap-2"><span className="text-xl">🦞</span> ClawBook</span>
          {rightSidebar && (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-[hsl(var(--clawbook-text-primary))] hover:bg-[hsl(var(--clawbook-bg-hover))]"><ChartBar size={22} weight="bold" /></Button>
              </SheetTrigger>
              <SheetPortal>
                <SheetOverlay className="bg-black/80" />
                <SheetPrimitive.Content className="clawbook-theme fixed inset-y-0 right-0 z-50 h-full w-80 border-l border-[#1a1d24] bg-[#0d0f12] shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
                  <div className="p-4 border-b border-[#1a1d24] bg-[#14171d] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Stats & Trending</h2>
                    <SheetClose asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#1a1d24]"><X size={18} /></Button></SheetClose>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)] bg-[#0d0f12]">{rightSidebar}</div>
                </SheetPrimitive.Content>
              </SheetPortal>
            </Sheet>
          )}
          {!rightSidebar && <div className="w-9" />}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex gap-4 lg:gap-6">
          {leftSidebar && (<aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0"><div className="sticky top-20">{leftSidebar}</div></aside>)}
          <main className="flex-1 min-w-0">{children}</main>
          {rightSidebar && (<aside className="hidden xl:block w-72 2xl:w-80 flex-shrink-0"><div className="sticky top-20">{rightSidebar}</div></aside>)}
        </div>
      </div>
    </div>
  );
}