import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function truncateWallet(wallet: string): string {
  if (wallet.length <= 8) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function useLiveTradeToasts() {
  const lastToastAt = useRef(0);
  const tokenCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const channel = supabase
      .channel("live-trade-toasts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "launchpad_transactions",
        },
        async (payload) => {
          const now = Date.now();
          // Rate limit: 1 toast per 3 seconds
          if (now - lastToastAt.current < 3000) return;
          lastToastAt.current = now;

          const tx = payload.new as {
            transaction_type: string;
            sol_amount: number;
            token_id: string;
            user_wallet: string;
            user_profile_id?: string | null;
          };

          // Get token name from cache or fetch
          let tokenName = tokenCache.current[tx.token_id];
          if (!tokenName) {
            const { data } = await supabase
              .from("tokens")
              .select("ticker")
              .eq("id", tx.token_id)
              .maybeSingle();
            tokenName = data?.ticker || "TOKEN";
            tokenCache.current[tx.token_id] = tokenName;
          }

          // Get username if available
          let displayName = truncateWallet(tx.user_wallet);
          if (tx.user_profile_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", tx.user_profile_id)
              .maybeSingle();
            if (profile?.username) displayName = profile.username;
          }

          const isBuy = tx.transaction_type === "buy";
          const emoji = isBuy ? "🟢" : "🔴";
          const action = isBuy ? "bought" : "sold";
          const solFormatted = Number(tx.sol_amount).toFixed(2);

          toast(`${emoji} ${displayName} ${action} ${solFormatted} SOL of $${tokenName}`, {
            duration: 4000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
