import { createContext, useContext, useState, ReactNode } from "react";

interface MatrixModeContextType {
  matrixEnabled: boolean;
  toggleMatrix: () => void;
}

const MatrixModeContext = createContext<MatrixModeContextType>({
  matrixEnabled: true,
  toggleMatrix: () => {},
});

export function MatrixModeProvider({ children }: { children: ReactNode }) {
  const [matrixEnabled, setMatrixEnabled] = useState(() =>
    localStorage.getItem("matrix-mode") !== "false"
  );

  const toggleMatrix = () => {
    setMatrixEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("matrix-mode", String(next));
      return next;
    });
  };

  return (
    <MatrixModeContext.Provider value={{ matrixEnabled, toggleMatrix }}>
      {children}
    </MatrixModeContext.Provider>
  );
}

export function useMatrixMode() {
  return useContext(MatrixModeContext);
}
