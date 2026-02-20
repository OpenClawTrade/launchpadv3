import { ReactNode } from "react";
import { useMatrixMode } from "@/contexts/MatrixModeContext";

interface MatrixContentCardProps {
  children: ReactNode;
  className?: string;
}

export function MatrixContentCard({ children, className = "" }: MatrixContentCardProps) {
  const { matrixEnabled } = useMatrixMode();

  if (!matrixEnabled) return <>{children}</>;

  return (
    <div className={`bg-background/85 backdrop-blur-md rounded-2xl border border-border/30 p-6 sm:p-8 my-4 ${className}`}>
      {children}
    </div>
  );
}
