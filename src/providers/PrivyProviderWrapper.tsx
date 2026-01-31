import { ReactNode, createContext, useContext } from "react";

// Context to track if Privy is available - DISABLED
const PrivyAvailableContext = createContext(false);

export function usePrivyAvailable() {
  return useContext(PrivyAvailableContext);
}

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

/**
 * Privy is currently DISABLED.
 * Using direct Phantom wallet connection instead.
 */
export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  // Always return false - Privy is disabled
  return (
    <PrivyAvailableContext.Provider value={false}>
      {children}
    </PrivyAvailableContext.Provider>
  );
}
