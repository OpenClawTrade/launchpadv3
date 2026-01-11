import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import trenchesLogo from "@/assets/trenches-logo.png";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Lazy load Privy - it's a heavy dependency
const PrivyProvider = lazy(() =>
  import("@privy-io/react-auth").then((mod) => ({ default: mod.PrivyProvider }))
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
    const fetchRuntimeConfig = async (retries = 3): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Use direct fetch with timeout for more reliability
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-config`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({}),
              signal: controller.signal,
            }
          );
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data?.privyAppId) {
              console.log('[Privy] Loaded App ID from edge function');
              setResolvedAppId((data.privyAppId ?? "").trim());
              setChecked(true);
              return;
            }
          }
        } catch (e) {
          console.warn(`[Privy] Config fetch attempt ${attempt}/${retries} failed:`, e);
          if (attempt < retries) {
            // Wait before retry with exponential backoff
            await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
      }
      
      console.warn('[Privy] All config fetch attempts failed');
      setChecked(true);
    };

    fetchRuntimeConfig();
  }, [checked]);

  const appId = resolvedAppId;
  const privyAvailable = checked && isValidPrivyAppId(appId);

  // Provide the missing Solana external wallet connectors so wallet login can
  // hand off to browser wallets like Phantom.
  const solanaConnectors = useMemo(
    () => toSolanaWalletConnectors({ shouldAutoConnect: false }),
    []
  );

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

            // Required for external Solana wallets (e.g. Phantom)
            externalWallets: {
              solana: {
                connectors: solanaConnectors,
              },
            },

            // Appearance configuration
            appearance: {
              theme: "dark",
              accentColor: "#9945FF", // Solana purple
              logo: trenchesLogo,
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
