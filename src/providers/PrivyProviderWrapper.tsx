import { ReactNode, createContext, useContext, useEffect, useState, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

// Lazy load Privy - it's a heavy dependency
const PrivyProvider = lazy(() => 
  import("@privy-io/react-auth").then(mod => ({ default: mod.PrivyProvider }))
);

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

  const [resolvedAppId, setResolvedAppId] = useState<string>(() => {
    // Initialize synchronously if build-time value is valid
    if (isValidPrivyAppId(buildTimeAppId)) {
      return buildTimeAppId;
    }
    return "";
  });
  
  const [checked, setChecked] = useState(() => isValidPrivyAppId(buildTimeAppId));
  const fetchAttempted = useRef(false);

  useEffect(() => {
    // Skip if already resolved from build-time or already attempted fetch
    if (checked || fetchAttempted.current) return;
    fetchAttempted.current = true;

    // Only fetch if build-time value is missing
    const fetchRuntimeConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("public-config", {
          body: {},
        });

        if (!error && data?.privyAppId) {
          setResolvedAppId((data.privyAppId ?? "").trim());
        }
      } catch (e) {
        console.warn("Failed to fetch runtime config for Privy", e);
      } finally {
        setChecked(true);
      }
    };

    fetchRuntimeConfig();
  }, [checked]);

  const appId = resolvedAppId;
  const privyAvailable = checked && isValidPrivyAppId(appId);

  // IMPORTANT: Don't block render - show children immediately while checking
  // Only show minimal loading if we MUST wait for runtime fetch
  if (!checked && !isValidPrivyAppId(buildTimeAppId)) {
    // Show children with auth disabled while fetching config
    return (
      <PrivyAvailableContext.Provider value={false}>
        {children}
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
      <Suspense fallback={children}>
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
      </Suspense>
    </PrivyAvailableContext.Provider>
  );
}
