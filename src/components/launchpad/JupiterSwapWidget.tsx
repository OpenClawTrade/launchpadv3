import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

// Jupiter Plugin type declarations
declare global {
  interface Window {
    Jupiter?: {
      init: (config: JupiterConfig) => void;
      close: () => void;
    };
  }
}

interface JupiterConfig {
  displayMode: "integrated" | "modal" | "widget";
  integratedTargetId?: string;
  endpoint?: string;
  formProps?: {
    initialInputMint?: string;
    initialOutputMint?: string;
    fixedOutputMint?: boolean;
    initialAmount?: string;
  };
  enableWalletPassthrough?: boolean;
  passthroughWalletContextState?: any;
  onSuccess?: (result: { txid: string }) => void;
  onSwapError?: (error: { error: string }) => void;
}

interface JupiterSwapWidgetProps {
  outputMint: string;
  tokenName?: string;
  tokenTicker?: string;
}

const JUPITER_PLUGIN_SCRIPT = "https://terminal.jup.ag/main-v4.js";
const JUPITER_PLUGIN_CSS = "https://terminal.jup.ag/main-v4.css";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export function JupiterSwapWidget({ outputMint, tokenName, tokenTicker }: JupiterSwapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Jupiter Plugin script
  useEffect(() => {
    // Check if already loaded
    if (window.Jupiter) {
      setIsScriptLoaded(true);
      return;
    }

    // Load CSS
    if (!document.querySelector(`link[href="${JUPITER_PLUGIN_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = JUPITER_PLUGIN_CSS;
      document.head.appendChild(link);
    }

    // Load Script
    if (!document.querySelector(`script[src="${JUPITER_PLUGIN_SCRIPT}"]`)) {
      const script = document.createElement("script");
      script.src = JUPITER_PLUGIN_SCRIPT;
      script.async = true;
      script.onload = () => {
        setIsScriptLoaded(true);
      };
      script.onerror = () => {
        console.error("[Jupiter] Failed to load plugin script");
        setHasError(true);
        setIsLoading(false);
      };
      document.body.appendChild(script);
    } else {
      // Script tag exists but might still be loading
      const checkLoaded = setInterval(() => {
        if (window.Jupiter) {
          setIsScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (!window.Jupiter) {
          setHasError(true);
          setIsLoading(false);
        }
      }, 10000);
    }
  }, []);

  // Initialize Jupiter once script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !window.Jupiter || !outputMint) return;

    const initJupiter = () => {
      try {
        window.Jupiter?.init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-terminal-container",
          formProps: {
            initialInputMint: SOL_MINT,
            initialOutputMint: outputMint,
            fixedOutputMint: true,
            initialAmount: "0.1",
          },
          enableWalletPassthrough: true,
          onSuccess: ({ txid }) => {
            console.log("[Jupiter] Swap success:", txid);
          },
          onSwapError: ({ error }) => {
            console.error("[Jupiter] Swap error:", error);
          },
        });
        setIsLoading(false);
      } catch (err) {
        console.error("[Jupiter] Init error:", err);
        setHasError(true);
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initJupiter, 500);

    return () => {
      clearTimeout(timer);
      // Cleanup Jupiter on unmount
      try {
        window.Jupiter?.close();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [isScriptLoaded, outputMint]);

  // Fallback: External Jupiter link
  const jupiterUrl = `https://jup.ag/swap/SOL-${outputMint}`;

  if (hasError) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground mb-4">
          Unable to load the swap widget. Trade on Jupiter directly:
        </p>
        <a href={jupiterUrl} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Trade on Jupiter
          </Button>
        </a>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Swap via Jupiter</h3>
            <p className="text-xs text-muted-foreground">
              Trade {tokenTicker || "tokens"} on the best DEX aggregator
            </p>
          </div>
          <a href={jupiterUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
          </a>
        </div>
      </div>

      <div 
        id="jupiter-terminal-container" 
        ref={containerRef}
        className="min-h-[400px] bg-background relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading Jupiter...</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
