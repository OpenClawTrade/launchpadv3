import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type PublicConfig = {
  privyAppId?: string;
  meteoraApiUrl?: string;
  heliusRpcUrl?: string;
};

declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
  }
}

/**
 * Loads runtime configuration from the backend so the frontend can work even
 * when build-time Vite env vars are not injected.
 */
export function RuntimeConfigBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("public-config");
        if (cancelled) return;
        if (error) throw error;

        const cfg = (data ?? {}) as PublicConfig;
        window.__PUBLIC_CONFIG__ = cfg;

        if (cfg.meteoraApiUrl) localStorage.setItem("meteoraApiUrl", cfg.meteoraApiUrl);
        if (cfg.heliusRpcUrl) localStorage.setItem("heliusRpcUrl", cfg.heliusRpcUrl);
      } catch (e) {
        // Non-fatal: hooks will fall back to window.location.origin.
        console.warn("[RuntimeConfig] Failed to load public-config", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
