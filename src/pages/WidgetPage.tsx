import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";

// Lazy load widget components
const TokenLauncherWidget = lazy(() => import("@/components/widgets/TokenLauncherWidget"));
const TradePanelWidget = lazy(() => import("@/components/widgets/TradePanelWidget"));
const TokenListWidget = lazy(() => import("@/components/widgets/TokenListWidget"));

interface WidgetConfig {
  apiKey: string;
  theme: "dark" | "light";
  accentColor?: string;
  hideHeader?: boolean;
  mintAddress?: string;
  poolAddress?: string;
  limit?: number;
}

function WidgetLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function InvalidWidget({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-destructive p-4">
      <p className="text-center">{message}</p>
    </div>
  );
}

export default function WidgetPage() {
  const { type } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse configuration from URL params
    const apiKey = searchParams.get("apiKey");
    const theme = (searchParams.get("theme") || "dark") as "dark" | "light";
    const accentColor = searchParams.get("accentColor");
    const hideHeader = searchParams.get("hideHeader") === "true";
    const mintAddress = searchParams.get("mintAddress");
    const poolAddress = searchParams.get("poolAddress");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!apiKey) {
      setError("Missing apiKey parameter");
      return;
    }

    setConfig({
      apiKey,
      theme,
      accentColor: accentColor ? decodeURIComponent(accentColor) : undefined,
      hideHeader,
      mintAddress: mintAddress || undefined,
      poolAddress: poolAddress || undefined,
      limit,
    });

    // Apply theme to document
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");

    // Apply accent color if provided
    if (accentColor) {
      document.documentElement.style.setProperty("--primary", accentColor);
    }

    // Notify parent window that widget is ready
    window.parent.postMessage({ type: "widget-ready", widgetType: type }, "*");
  }, [searchParams, type]);

  // Handle messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "update-config") {
        setConfig((prev) => prev ? { ...prev, ...event.data.config } : null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (error) {
    return <InvalidWidget message={error} />;
  }

  if (!config) {
    return <WidgetLoader />;
  }

  // Render appropriate widget based on type
  const renderWidget = () => {
    switch (type) {
      case "launcher":
        return <TokenLauncherWidget config={config} />;
      case "trade":
        if (!config.mintAddress && !config.poolAddress) {
          return <InvalidWidget message="Missing mintAddress or poolAddress parameter" />;
        }
        return <TradePanelWidget config={config} />;
      case "token-list":
        return <TokenListWidget config={config} />;
      default:
        return <InvalidWidget message={`Unknown widget type: ${type}`} />;
    }
  };

  return (
    <div className={`min-h-screen bg-background text-foreground ${config.theme}`}>
      <Suspense fallback={<WidgetLoader />}>
        {renderWidget()}
      </Suspense>
    </div>
  );
}
