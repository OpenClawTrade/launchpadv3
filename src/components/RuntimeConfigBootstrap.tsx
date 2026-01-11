import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PublicConfig = {
  privyAppId?: string;
  meteoraApiUrl?: string;
  heliusRpcUrl?: string;
};

declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
    __PUBLIC_CONFIG_LOADED__?: boolean;
  }
}

/**
 * Loads runtime configuration from the backend so the frontend can work even
 * when build-time Vite env vars are not injected.
 * 
 * This runs on app mount and stores config to localStorage for persistence.
 */
export function RuntimeConfigBootstrap() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // If already loaded from localStorage, skip fetch
    const existingApiUrl = localStorage.getItem("meteoraApiUrl");
    const existingRpcUrl = localStorage.getItem("heliusRpcUrl");
    
    if (existingApiUrl && existingApiUrl.startsWith("https://")) {
      console.log("[RuntimeConfig] Using cached config from localStorage");
      window.__PUBLIC_CONFIG__ = {
        meteoraApiUrl: existingApiUrl,
        heliusRpcUrl: existingRpcUrl || undefined,
      };
      window.__PUBLIC_CONFIG_LOADED__ = true;
      setLoaded(true);
      // Still fetch in background to update if changed
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("public-config");
        if (cancelled) return;
        if (error) throw error;

        const cfg = (data ?? {}) as PublicConfig;
        
        // Store to window
        window.__PUBLIC_CONFIG__ = cfg;
        window.__PUBLIC_CONFIG_LOADED__ = true;

        // Persist to localStorage for next page load
        if (cfg.meteoraApiUrl) {
          localStorage.setItem("meteoraApiUrl", cfg.meteoraApiUrl);
          console.log("[RuntimeConfig] Saved meteoraApiUrl:", cfg.meteoraApiUrl);
        }
        if (cfg.heliusRpcUrl) {
          localStorage.setItem("heliusRpcUrl", cfg.heliusRpcUrl);
          console.log("[RuntimeConfig] Saved heliusRpcUrl:", cfg.heliusRpcUrl.substring(0, 50) + "...");
        }
        
        setLoaded(true);
      } catch (e) {
        console.warn("[RuntimeConfig] Failed to load public-config", e);
        window.__PUBLIC_CONFIG_LOADED__ = true; // Mark as loaded anyway so app doesn't wait forever
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
