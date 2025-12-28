import { ReactNode, createContext, useContext } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

// Context to track if Privy is available
const PrivyAvailableContext = createContext(false);

export function usePrivyAvailable() {
  return useContext(PrivyAvailableContext);
}

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;

  // Check if appId is valid (not empty and not a template string)
  const isValidAppId = appId && !appId.startsWith("${") && appId.length > 10;

  if (!isValidAppId) {
    console.warn("Privy App ID not configured - auth features disabled. Set VITE_PRIVY_APP_ID in your secrets.");
    return (
      <PrivyAvailableContext.Provider value={false}>
        {children}
      </PrivyAvailableContext.Provider>
    );
  }

  return (
    <PrivyAvailableContext.Provider value={true}>
      <PrivyProvider
        appId={appId}
        config={{
          // Login methods - Solana wallet, Twitter/X, and email
          loginMethods: ["wallet", "twitter", "email"],
          
          // Appearance configuration
          appearance: {
            theme: "dark",
            accentColor: "#9945FF", // Solana purple
            showWalletLoginFirst: true,
            walletChainType: "solana-only", // Only show Solana wallets
            walletList: ["phantom", "solflare", "backpack", "detected_wallets"],
          },

          // Embedded wallets configuration - AUTO-CREATE Solana wallet on login
          embeddedWallets: {
            solana: {
              // Create Solana embedded wallet for ALL users on login
              createOnLogin: "all-users",
            },
            // Disable Ethereum embedded wallets
            ethereum: {
              createOnLogin: "off",
            },
          },

          // Legal links (optional - update with your own)
          legal: {
            termsAndConditionsUrl: "/terms",
            privacyPolicyUrl: "/privacy",
          },
        }}
      >
        {children}
      </PrivyProvider>
    </PrivyAvailableContext.Provider>
  );
}
