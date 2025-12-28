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
  const rawAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const appId = (rawAppId ?? "").trim();

  // Accept any non-empty appId that's not a template placeholder
  const isValidAppId = appId.length > 0 && !appId.includes("${");

  if (!isValidAppId) {
    console.warn(
      "Privy App ID not configured - auth features disabled. Please set VITE_PRIVY_APP_ID in your Lovable Cloud secrets.",
      { rawAppId }
    );
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
