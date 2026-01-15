import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user (by wallet address) has admin role.
 * Uses the is_admin() RPC function which checks user_roles table.
 */
export function useIsAdmin(walletAddress: string | null | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function checkAdmin() {
      setIsLoading(true);
      try {
        // First get profile ID from wallet address
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("solana_wallet_address", walletAddress)
          .maybeSingle();

        if (!profile?.id) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        // Check if this profile has admin role
        const { data: hasRole } = await supabase.rpc("has_role", {
          _user_id: profile.id,
          _role: "admin",
        });

        if (!cancelled) {
          setIsAdmin(hasRole === true);
        }
      } catch (err) {
        console.error("[useIsAdmin] Error checking admin status:", err);
        if (!cancelled) {
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return { isAdmin, isLoading };
}
