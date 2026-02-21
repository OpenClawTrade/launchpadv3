import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfaListing {
  id: string;
  nfa_mint_id: string;
  seller_wallet: string;
  asking_price_sol: number;
  status: string;
  buyer_wallet: string | null;
  listed_at: string;
  sold_at: string | null;
}

export function useNfaMarketplace() {
  const listingsQuery = useQuery({
    queryKey: ["nfa-marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_listings")
        .select("*")
        .eq("status", "active")
        .order("asking_price_sol", { ascending: true });
      if (error) return [];
      return data as NfaListing[];
    },
  });

  // Get mint details for each listing
  const mintIds = listingsQuery.data?.map(l => l.nfa_mint_id) ?? [];
  const mintsQuery = useQuery({
    queryKey: ["nfa-marketplace-mints", mintIds],
    enabled: mintIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_mints")
        .select("*")
        .in("id", mintIds);
      if (error) return [];
      return data;
    },
  });

  const mintMap = new Map((mintsQuery.data ?? []).map(m => [m.id, m]));

  const enrichedListings = (listingsQuery.data ?? []).map(listing => ({
    ...listing,
    mint: mintMap.get(listing.nfa_mint_id),
  }));

  const floorPrice = enrichedListings.length > 0 
    ? Math.min(...enrichedListings.map(l => l.asking_price_sol))
    : null;

  return {
    listings: enrichedListings,
    floorPrice,
    totalListed: enrichedListings.length,
    isLoading: listingsQuery.isLoading,
  };
}
