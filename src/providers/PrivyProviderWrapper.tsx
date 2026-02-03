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
import tunaLogo from "@/assets/tuna-logo.png";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

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

function getHeliusRpcUrlFromRuntime(): string | null {
  // 1) localStorage (set by RuntimeConfigBootstrap)
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("heliusRpcUrl");
    if (fromStorage && fromStorage.startsWith("https://") && !fromStorage.includes("${")) {
      return fromStorage.trim();
    }

    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl as string | undefined;
    if (fromWindow && fromWindow.startsWith("https://") && !fromWindow.includes("${")) {
      return fromWindow.trim();
    }
  }

  // 2) build-time env
  const fromEnv = import.meta.env.VITE_HELIUS_RPC_URL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.startsWith("https://") && !fromEnv.includes("${")) {
    return fromEnv.trim();
  }

  // 3) api key -> construct paid Helius URL
  const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 10 && !apiKey.includes("${")) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey.trim()}`;
  }

  return null;
}

function toWebsocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const rawAppId = import.meta.env.VITE_PRIVY_APP_ID;
  const buildTimeAppId = (rawAppId ?? "").trim();

  const [resolvedAppId, setResolvedAppId] = useState<string>(() => {
    if (isValidPrivyAppId(buildTimeAppId)) return buildTimeAppId;
    return "";
  });

  // "checked" means we've attempted at least one runtime fetch.
  const [checked, setChecked] = useState(() => isValidPrivyAppId(buildTimeAppId));

  const retryTimer = useRef<number | null>(null);

  // Fetch runtime config with retries + periodic re-attempts (for flaky networks)
  useEffect(() => {
    if (isValidPrivyAppId(buildTimeAppId)) return;
    if (isValidPrivyAppId(resolvedAppId)) return;

    let cancelled = false;

    const attemptFetch = async () => {
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 20000);

          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-config`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({}),
            signal: controller.signal,
          });

          window.clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`public-config request failed (${res.status})`);
          }

          const data = await res.json();
          const privyAppId = (data?.privyAppId ?? "").trim();

          if (!cancelled && isValidPrivyAppId(privyAppId)) {
            setResolvedAppId(privyAppId);
            setChecked(true);
            return;
          }
        } catch (e) {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }

      // Mark checked so UI can render fallback, but keep retrying periodically.
      if (!cancelled) setChecked(true);

      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => {
        if (!cancelled) {
          setChecked(false);
        }
      }, 5000);
    };

    attemptFetch();

    return () => {
      cancelled = true;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [buildTimeAppId, resolvedAppId, checked]);

  const appId = resolvedAppId;
  const privyAvailable = checked && isValidPrivyAppId(appId);

  const solanaConnectors = useMemo(
    () => toSolanaWalletConnectors({ shouldAutoConnect: false }),
    []
  );

  // Privy embedded Solana wallets require Solana RPC config.
  // Use Helius when available; otherwise fall back to the public Solana endpoint.
  const solanaHttpRpcUrl = getHeliusRpcUrlFromRuntime() ?? "https://api.mainnet-beta.solana.com";
  const solanaWsUrl = toWebsocketUrl(solanaHttpRpcUrl);

  if (!privyAvailable) {
    return (
      <PrivyAvailableContext.Provider value={false}>
        {children}
      </PrivyAvailableContext.Provider>
    );
  }

  return (
    <Suspense
      fallback={
        <PrivyAvailableContext.Provider value={false}>
          {children}
        </PrivyAvailableContext.Provider>
      }
    >
      <PrivyAvailableContext.Provider value={true}>
        <PrivyProvider
          appId={appId}
          config={{
            loginMethods: ["wallet", "twitter", "email"],
            externalWallets: {
              solana: {
                connectors: solanaConnectors,
              },
            },
            // Required for Privy's embedded wallet transaction UIs.
            solana: {
              rpcs: {
                "solana:mainnet": {
                  rpc: createSolanaRpc(solanaHttpRpcUrl),
                  rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
                  blockExplorerUrl: "https://solscan.io",
                },
              },
            },
            appearance: {
              theme: "dark",
              accentColor: "#22c55e", // RIFT green
              logo: tunaLogo,
              showWalletLoginFirst: true,
              walletChainType: "solana-only",
              walletList: ["phantom", "solflare", "backpack", "detected_wallets"],
            },
            embeddedWallets: {
              solana: {
                createOnLogin: "all-users",
              },
              ethereum: {
                createOnLogin: "off",
              },
            },
            legal: {
              termsAndConditionsUrl: "/terms",
              privacyPolicyUrl: "/privacy",
            },
          }}
        >
          {children}
        </PrivyProvider>
      </PrivyAvailableContext.Provider>
    </Suspense>
  );
}
