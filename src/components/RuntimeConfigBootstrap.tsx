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
    const normalize = (url: string) => url.replace(/\/+$/, "");

    // If we have a cached URL from a previous session, try to use it BUT also
    // protect against project renames that introduce redirects (redirects break
    // CORS preflight when we later send custom headers).
    const existingApiUrl = localStorage.getItem("meteoraApiUrl");
    const existingRpcUrl = localStorage.getItem("heliusRpcUrl");

    const seedFromStorage = async () => {
      if (!existingApiUrl || !existingApiUrl.startsWith("https://")) return;

      try {
        // Use a simple GET (no custom headers) to an endpoint that is known to
        // include CORS headers. This lets us detect redirects safely.
        const res = await fetch(`${normalize(existingApiUrl)}/api/vanity/status`, {
          method: "GET",
        });

        const finalOrigin = normalize(new URL(res.url).origin);
        const normalizedExisting = normalize(existingApiUrl);

        if (finalOrigin && finalOrigin !== normalizedExisting) {
          localStorage.setItem("meteoraApiUrl", finalOrigin);
        }

        window.__PUBLIC_CONFIG__ = {
          meteoraApiUrl: finalOrigin || normalizedExisting,
          heliusRpcUrl: existingRpcUrl || undefined,
        };
      } catch {
        // If we can't reach it, fall back to cached values until runtime config loads.
        window.__PUBLIC_CONFIG__ = {
          meteoraApiUrl: normalize(existingApiUrl),
          heliusRpcUrl: existingRpcUrl || undefined,
        };
      }
    };

    let cancelled = false;

    (async () => {
      try {
        // Seed runtime config ASAP (safe redirect handling) before asking backend.
        await seedFromStorage();

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
        }
        if (cfg.heliusRpcUrl) {
          localStorage.setItem("heliusRpcUrl", cfg.heliusRpcUrl);
        }
        
        setLoaded(true);
      } catch (e) {
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
