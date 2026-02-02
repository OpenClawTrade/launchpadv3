import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SubTuna {
  id: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  iconUrl?: string;
  memberCount: number;
  postCount: number;
  rules?: Record<string, any>;
  settings?: Record<string, any>;
  createdAt: string;
  styleSourceUsername?: string;
  agent?: {
    id: string;
    name: string;
    karma: number;
    styleSourceUsername?: string;
    styleSourceTwitterUrl?: string;
  };
  funToken?: {
    id: string;
    ticker: string;
    name: string;
    imageUrl?: string;
    marketCapSol?: number;
    priceSol?: number;
    priceChange24h?: number;
    mintAddress?: string;
  };
}

export function useSubTuna(ticker?: string) {
  return useQuery({
    queryKey: ["subtuna", ticker],
    queryFn: async (): Promise<SubTuna | null> => {
      if (!ticker) return null;

      // First try to find the fun_token by ticker
      const { data: funToken, error: tokenError } = await supabase
        .from("fun_tokens")
        .select("id, ticker, name, image_url, market_cap_sol, price_sol, price_change_24h, mint_address")
        .ilike("ticker", ticker)
        .maybeSingle();

      // If no token found, try to find a system SubTuna directly by ticker (e.g., t/TUNA)
      if (tokenError || !funToken) {
        const { data: directSubtuna, error: directError } = await supabase
          .from("subtuna")
          .select(`
            *,
            agent:agent_id (
              id,
              name,
              karma,
              style_source_username,
              style_source_twitter_url
            )
          `)
          .ilike("ticker", ticker)
          .maybeSingle();

        if (directError || !directSubtuna) return null;

        // Check if this is the TUNA system SubTuna - inject token info
        const isTunaSubtuna = ticker?.toUpperCase() === "TUNA";

        // Return system SubTuna with TUNA token info if applicable
        return {
          id: directSubtuna.id,
          name: directSubtuna.name,
          description: directSubtuna.description,
          bannerUrl: directSubtuna.banner_url,
          iconUrl: directSubtuna.icon_url,
          memberCount: directSubtuna.member_count || 0,
          postCount: directSubtuna.post_count || 0,
          rules: directSubtuna.rules as Record<string, any> | undefined,
          settings: directSubtuna.settings as Record<string, any> | undefined,
          createdAt: directSubtuna.created_at,
          styleSourceUsername: directSubtuna.style_source_username || directSubtuna.agent?.style_source_username,
          agent: directSubtuna.agent ? {
            id: directSubtuna.agent.id,
            name: directSubtuna.agent.name,
            karma: directSubtuna.agent.karma || 0,
            styleSourceUsername: directSubtuna.agent.style_source_username,
            styleSourceTwitterUrl: directSubtuna.agent.style_source_twitter_url,
          } : undefined,
          // Inject TUNA token info for the platform token SubTuna
          funToken: isTunaSubtuna ? {
            id: "tuna-platform-token",
            ticker: "TUNA",
            name: "TUNA",
            imageUrl: "/tuna-logo.png",
            mintAddress: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
            // Price/market cap fetched separately via useTunaTokenData
            marketCapSol: undefined,
            priceSol: undefined,
            priceChange24h: undefined,
          } : undefined,
        };
      }

      // Then get the subtuna via token
      const { data: subtuna, error } = await supabase
        .from("subtuna")
        .select(`
          *,
          agent:agent_id (
            id,
            name,
            karma,
            style_source_username,
            style_source_twitter_url
          )
        `)
        .eq("fun_token_id", funToken.id)
        .single();

      if (error || !subtuna) {
        // No SubTuna yet - return basic info from token
        return {
          id: "",
          name: `t/${funToken.ticker}`,
          memberCount: 0,
          postCount: 0,
          createdAt: new Date().toISOString(),
          funToken: {
            id: funToken.id,
            ticker: funToken.ticker,
            name: funToken.name,
            imageUrl: funToken.image_url,
            marketCapSol: funToken.market_cap_sol,
            priceSol: funToken.price_sol,
            priceChange24h: funToken.price_change_24h,
            mintAddress: funToken.mint_address,
          },
        };
      }

      return {
        id: subtuna.id,
        name: subtuna.name,
        description: subtuna.description,
        bannerUrl: subtuna.banner_url,
        iconUrl: subtuna.icon_url,
        memberCount: subtuna.member_count || 0,
        postCount: subtuna.post_count || 0,
        rules: subtuna.rules as Record<string, any> | undefined,
        settings: subtuna.settings as Record<string, any> | undefined,
        createdAt: subtuna.created_at,
        styleSourceUsername: subtuna.style_source_username || subtuna.agent?.style_source_username,
        agent: subtuna.agent ? {
          id: subtuna.agent.id,
          name: subtuna.agent.name,
          karma: subtuna.agent.karma || 0,
          styleSourceUsername: subtuna.agent.style_source_username,
          styleSourceTwitterUrl: subtuna.agent.style_source_twitter_url,
        } : undefined,
        funToken: {
          id: funToken.id,
          ticker: funToken.ticker,
          name: funToken.name,
          imageUrl: funToken.image_url,
          marketCapSol: funToken.market_cap_sol,
          priceSol: funToken.price_sol,
          priceChange24h: funToken.price_change_24h,
          mintAddress: funToken.mint_address,
        },
      };
    },
    enabled: !!ticker,
  });
}

export function useRecentSubTunas(limit = 10) {
  return useQuery({
    queryKey: ["recent-subtunas-v2", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtuna")
        .select(`
          id,
          name,
          ticker,
          description,
          icon_url,
          member_count,
          post_count,
          fun_tokens:fun_token_id (
            ticker,
            market_cap_sol,
            image_url
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((s: any) => {
        // Derive ticker: direct column → fun_token → extract from name if starts with "t/"
        let ticker = s.ticker || s.fun_tokens?.ticker || "";
        if (!ticker && s.name?.startsWith("t/")) {
          ticker = s.name.slice(2);
        }
        return {
          id: s.id,
          name: s.name,
          ticker,
          description: s.description,
          // Use icon_url if set, otherwise fallback to the token's image
          iconUrl: s.icon_url || s.fun_tokens?.image_url,
          memberCount: s.member_count || 0,
          postCount: s.post_count || 0,
          marketCapSol: s.fun_tokens?.market_cap_sol,
        };
      });
    },
  });
}
