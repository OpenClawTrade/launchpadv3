import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFunTokens } from "@/hooks/useFunTokens";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, ExternalLink } from "lucide-react";

interface DesignConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    success: string;
    danger: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    logoSize: string;
  };
  layout: {
    style: string;
    borderRadius: string;
    spacing: string;
    headerPosition: string;
  };
  branding: {
    name: string;
    tagline: string;
    logoStyle: string;
  };
  effects: {
    gradients: boolean;
    animations: boolean;
    glowEffects: boolean;
    particles: boolean;
  };
}

const defaultDesign: DesignConfig = {
  colors: {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    background: "#0A0A0A",
    surface: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
    accent: "#F59E0B",
    success: "#22C55E",
    danger: "#EF4444",
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter",
    logoSize: "2xl",
  },
  layout: {
    style: "modern",
    borderRadius: "lg",
    spacing: "normal",
    headerPosition: "top",
  },
  branding: {
    name: "Launchpad",
    tagline: "Trade tokens with low fees",
    logoStyle: "text",
  },
  effects: {
    gradients: true,
    animations: true,
    glowEffects: false,
    particles: false,
  },
};

interface Token {
  id: string;
  name: string;
  ticker: string;
  mint_address: string;
  image_url: string | null;
  price_sol: number | null;
  volume_24h_sol: number | null;
  price_change_24h: number | null;
  market_cap_sol: number | null;
}

export default function LaunchpadTemplatePage() {
  const [searchParams] = useSearchParams();
  const launchpadId = searchParams.get("id");
  const { isAuthenticated, login, solanaAddress } = useAuth();
  
  const [design, setDesign] = useState<DesignConfig>(defaultDesign);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchpadName, setLaunchpadName] = useState("Launchpad");

  // Try to get design from env (for deployed version) or fetch from API
  useEffect(() => {
    // Check for embedded design config (deployed version)
    const envConfig = import.meta.env.VITE_DESIGN_CONFIG;
    if (envConfig) {
      try {
        const parsed = JSON.parse(envConfig);
        setDesign({ ...defaultDesign, ...parsed });
        if (parsed.branding?.name) setLaunchpadName(parsed.branding.name);
      } catch (e) {
        console.error("Failed to parse design config:", e);
      }
    }

    // Fetch launchpad data if ID provided
    if (launchpadId) {
      fetchLaunchpadData();
    } else {
      setLoading(false);
    }
  }, [launchpadId]);

  const fetchLaunchpadData = async () => {
    try {
      // Fetch launchpad config
      const lpResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad?id=${launchpadId}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const lpData = await lpResponse.json();
      
      if (lpData.launchpad) {
        if (lpData.launchpad.design_config) {
          setDesign({ ...defaultDesign, ...lpData.launchpad.design_config });
        }
        setLaunchpadName(lpData.launchpad.name || "Launchpad");
      }

      // Fetch linked tokens
      const tokensResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens?launchpadId=${launchpadId}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const tokensData = await tokensResponse.json();
      setTokens(tokensData.tokens || []);
    } catch (error) {
      console.error("Error fetching launchpad:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBorderRadius = (size: string) => {
    switch (size) {
      case "none": return "0px";
      case "sm": return "4px";
      case "md": return "8px";
      case "lg": return "12px";
      case "xl": return "16px";
      case "full": return "24px";
      default: return "12px";
    }
  };

  const radius = getBorderRadius(design.layout.borderRadius);

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: design.colors.background }}
      >
        <div 
          className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: design.colors.primary }}
        />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: design.colors.background,
        fontFamily: design.typography.bodyFont,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ 
          backgroundColor: design.colors.surface,
          borderColor: `${design.colors.text}10`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div 
            className="font-bold text-xl"
            style={{ color: design.colors.text }}
          >
            {launchpadName}
          </div>
          
          {isAuthenticated ? (
            <div 
              className="px-3 py-1.5 text-sm font-mono"
              style={{ 
                backgroundColor: `${design.colors.primary}20`,
                color: design.colors.primary,
                borderRadius: radius,
              }}
            >
              {solanaAddress?.slice(0, 4)}...{solanaAddress?.slice(-4)}
            </div>
          ) : (
            <Button
              onClick={() => login()}
              style={{ 
                backgroundColor: design.colors.primary,
                color: "#fff",
                borderRadius: radius,
              }}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="py-16 px-4"
        style={{
          background: design.effects.gradients
            ? `linear-gradient(180deg, ${design.colors.surface} 0%, ${design.colors.background} 100%)`
            : design.colors.surface,
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ 
              color: design.colors.text,
              fontFamily: design.typography.headingFont,
            }}
          >
            {design.branding.tagline}
          </h1>
          <p
            className="text-lg"
            style={{ color: design.colors.textMuted }}
          >
            Trade tokens with 2% fees • Powered by Meteora
          </p>
        </div>
      </section>

      {/* Tokens Grid */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2
          className="text-2xl font-bold mb-6"
          style={{ color: design.colors.text }}
        >
          Featured Tokens
        </h2>

        {tokens.length === 0 ? (
          <div
            className="text-center py-16"
            style={{ color: design.colors.textMuted }}
          >
            <p className="text-lg mb-2">No tokens available yet</p>
            <p className="text-sm">Tokens will appear here when added to this launchpad</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <Card
                key={token.id}
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                style={{
                  backgroundColor: design.colors.surface,
                  borderColor: `${design.colors.text}10`,
                  borderRadius: radius,
                }}
                onClick={() => window.location.href = `/token/${token.id}?launchpad=${launchpadId}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {token.image_url ? (
                      <img
                        src={token.image_url}
                        alt={token.ticker}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{ 
                          backgroundColor: `${design.colors.primary}30`,
                          color: design.colors.primary,
                        }}
                      >
                        {token.ticker?.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1">
                      <div 
                        className="font-semibold"
                        style={{ color: design.colors.text }}
                      >
                        {token.name}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: design.colors.textMuted }}
                      >
                        ${token.ticker}
                      </div>
                    </div>
                    {(token.price_change_24h ?? 0) !== 0 && (
                      <Badge
                        style={{
                          backgroundColor: (token.price_change_24h ?? 0) >= 0 
                            ? `${design.colors.success}20`
                            : `${design.colors.danger}20`,
                          color: (token.price_change_24h ?? 0) >= 0
                            ? design.colors.success
                            : design.colors.danger,
                        }}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {(token.price_change_24h ?? 0) >= 0 ? "+" : ""}
                        {(token.price_change_24h ?? 0).toFixed(1)}%
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div style={{ color: design.colors.textMuted }}>Price</div>
                      <div style={{ color: design.colors.text }}>
                        {(token.price_sol ?? 0).toFixed(8)} SOL
                      </div>
                    </div>
                    <div>
                      <div style={{ color: design.colors.textMuted }}>24h Volume</div>
                      <div style={{ color: design.colors.text }}>
                        {(token.volume_24h_sol ?? 0).toFixed(2)} SOL
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t" style={{ borderColor: `${design.colors.text}10` }}>
                    <Button
                      className="w-full"
                      style={{
                        backgroundColor: design.colors.primary,
                        color: "#fff",
                        borderRadius: radius,
                      }}
                    >
                      Trade
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-4 mt-8 border-t"
        style={{ 
          backgroundColor: design.colors.surface,
          borderColor: `${design.colors.text}10`,
        }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <p style={{ color: design.colors.textMuted }} className="text-sm">
            Powered by Trenches • 2% trading fees
          </p>
        </div>
      </footer>
    </div>
  );
}
