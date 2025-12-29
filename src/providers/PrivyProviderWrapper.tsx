import { ReactNode, createContext, useContext, useEffect, useState, Component, ErrorInfo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";

// Context to track if Privy is available
const PrivyAvailableContext = createContext(false);

export function usePrivyAvailable() {
  return useContext(PrivyAvailableContext);
}

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

function isValidPrivyAppId(appId: string) {
  return appId.length > 0 && !appId.includes("${");
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const rawAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const buildTimeAppId = (rawAppId ?? "").trim();

  const [resolvedAppId, setResolvedAppId] = useState<string>("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // 1) Prefer build-time env var (Vite replacement)
      if (isValidPrivyAppId(buildTimeAppId)) {
        if (!cancelled) {
          setResolvedAppId(buildTimeAppId);
          setChecked(true);
        }
        return;
      }

      // 2) Fallback to runtime fetch (fixes deployments that were built without the env var)
      try {
        const { data, error } = await supabase.functions.invoke("public-config", {
          body: {},
        });

        const fromRuntime = (data?.privyAppId ?? "").trim();
        if (!cancelled) {
          setResolvedAppId(fromRuntime);
        }

        if (error) {
          console.warn("Failed to load runtime config for Privy", error);
        }
      } catch (e) {
        console.warn("Failed to fetch runtime config for Privy", e);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [buildTimeAppId]);

  const appId = resolvedAppId;
  const privyAvailable = checked && isValidPrivyAppId(appId);

  // Show loading state while checking for Privy config
  if (!checked) {
    return (
      <PrivyAvailableContext.Provider value={false}>
        <div style={{ 
          minHeight: '100vh', 
          backgroundColor: '#0d0e12', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid transparent',
            borderTopColor: '#f0b90b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      </PrivyAvailableContext.Provider>
    );
  }

  if (!privyAvailable) {
    console.warn(
      "Privy App ID not configured - auth features disabled. Please set VITE_PRIVY_APP_ID in your Lovable Cloud secrets.",
      { rawAppIdPresent: !!rawAppId, runtimeResolved: !!resolvedAppId }
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
