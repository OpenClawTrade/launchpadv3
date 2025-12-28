import { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Solana external wallet connectors (Phantom, Solflare, etc.)
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;

  if (!appId) {
    console.error("VITE_PRIVY_APP_ID is not configured");
    return <>{children}</>;
  }

  return (
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

        // External wallet connectors for Solana
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
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
  );
}
