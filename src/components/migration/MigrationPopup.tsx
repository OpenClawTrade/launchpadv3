import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowsClockwise } from "@phosphor-icons/react";

export function MigrationPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hasSeen = localStorage.getItem("tuna_migration_seen");
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("tuna_migration_seen", "true");
    setIsOpen(false);
  };

  const goToMigrate = () => {
    localStorage.setItem("tuna_migration_seen", "true");
    setIsOpen(false);
    navigate("/migrate");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md border-amber-500/30 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ArrowsClockwise className="h-6 w-6 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} weight="bold" />
            <DialogTitle className="text-xl">$TUNA Token Migration</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>
              <strong className="text-foreground">$TUNA is migrating</strong> from the old pump.fun contract to a new ecosystem powering TUNA OS, OpenClaw, and fee distribution.
            </p>
            <p>
              You have a <strong className="text-amber-400">48-hour window</strong> to send your tokens to the collection wallet and register your migration. After the deadline, unclaimed tokens will not be migrated.
            </p>
            <p className="text-sm text-muted-foreground">
              Check your eligibility and migrate now on the Migration page.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-2">
          <Button onClick={goToMigrate} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold">
            Go to Migration
          </Button>
          <Button onClick={dismiss} variant="outline" className="flex-1">
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
