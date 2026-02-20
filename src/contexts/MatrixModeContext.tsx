import { createContext, useContext, useState, ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MatrixModeContextType {
  matrixEnabled: boolean;
  toggleMatrix: () => void;
}

const MatrixModeContext = createContext<MatrixModeContextType>({
  matrixEnabled: true,
  toggleMatrix: () => {},
});

export function MatrixModeProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [matrixEnabled, setMatrixEnabled] = useState(() =>
    localStorage.getItem("matrix-mode") !== "false"
  );

  // Force-disable matrix on mobile to prevent CJK character artifacts
  const effectiveEnabled = matrixEnabled && !isMobile;

  const toggleMatrix = () => {
    setMatrixEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("matrix-mode", String(next));
      return next;
    });
  };

  return (
    <MatrixModeContext.Provider value={{ matrixEnabled: effectiveEnabled, toggleMatrix }}>
      {children}
    </MatrixModeContext.Provider>
  );
}

export function useMatrixMode() {
  return useContext(MatrixModeContext);
}
