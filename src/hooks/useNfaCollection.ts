import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfaCollectionItem {
  id: string;
  slot_number: number;
  minter_wallet: string;
  owner_wallet: string | null;
  token_name: string | null;
  token_ticker: string | null;
  token_image_url: string | null;
  agent_name: string | null;
  agent_image_url: string | null;
  nfa_mint_address: string | null;
  status: string;
  listed_for_sale: boolean;
  listing_price_sol: number | null;
  created_at: string;
}

export function useNfaCollection() {
  const batchQuery = useQuery({
    queryKey: ["nfa-batch-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_batches")
        .select("*")
        .eq("status", "open")
        .order("batch_number", { ascending: true })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
  });

  const collectionQuery = useQuery({
    queryKey: ["nfa-collection-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfa_mints")
        .select("*")
        .order("slot_number", { ascending: true });
      if (error) return [];
      return data as NfaCollectionItem[];
    },
  });

  const totalMinted = collectionQuery.data?.length ?? 0;
  const uniqueOwners = new Set(collectionQuery.data?.map(m => m.owner_wallet).filter(Boolean)).size;
  const floorPrice = collectionQuery.data
    ?.filter(m => m.listed_for_sale && m.listing_price_sol)
    .reduce((min, m) => Math.min(min, m.listing_price_sol!), Infinity);

  return {
    batch: batchQuery.data,
    collection: collectionQuery.data ?? [],
    totalMinted,
    uniqueOwners,
    floorPrice: floorPrice === Infinity ? null : floorPrice,
    isLoading: batchQuery.isLoading || collectionQuery.isLoading,
  };
}
