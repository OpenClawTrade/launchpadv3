import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface XBotAccount {
  id: string;
  name: string;
  username: string;
  email: string | null;
  password_encrypted: string | null;
  totp_secret_encrypted: string | null;
  full_cookie_encrypted: string | null;
  auth_token_encrypted: string | null;
  ct0_token_encrypted: string | null;
  proxy_url: string | null;
  socks5_urls: string[];
  current_socks5_index: number;
  last_socks5_failure_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface XBotAccountRules {
  id: string;
  account_id: string;
  monitored_mentions: string[];
  tracked_cashtags: string[];
  min_follower_count: number;
  require_blue_verified: boolean;
  require_gold_verified: boolean;
  author_cooldown_hours: number;
  max_replies_per_thread: number;
  enabled: boolean;
  created_at: string;
}

export interface XBotAccountReply {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_author_id: string | null;
  tweet_text: string | null;
  conversation_id: string | null;
  reply_id: string | null;
  reply_text: string | null;
  reply_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface XBotQueueItem {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_author_id: string | null;
  tweet_text: string | null;
  conversation_id: string | null;
  follower_count: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export interface XBotAccountWithRules extends XBotAccount {
  rules?: XBotAccountRules;
}

export function useXBotAccounts() {
  const [accounts, setAccounts] = useState<XBotAccountWithRules[]>([]);
  const [replies, setReplies] = useState<XBotAccountReply[]>([]);
  const [queue, setQueue] = useState<XBotQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from("x_bot_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (accountsError) throw accountsError;

      const { data: rulesData, error: rulesError } = await supabase
        .from("x_bot_account_rules")
        .select("*");

      if (rulesError) throw rulesError;

      const accountsWithRules = (accountsData || []).map((account: XBotAccount) => ({
        ...account,
        rules: rulesData?.find((r: XBotAccountRules) => r.account_id === account.id),
      }));

      setAccounts(accountsWithRules);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  }, []);

  const fetchReplies = useCallback(async (accountId?: string) => {
    try {
      let query = supabase
        .from("x_bot_account_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  }, []);

  const fetchQueue = useCallback(async (accountId?: string) => {
    try {
      let query = supabase
        .from("x_bot_account_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setQueue(data || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  }, []);

  const createAccount = async (account: Partial<XBotAccount>, rules?: Partial<XBotAccountRules>) => {
    try {
      const { data: newAccount, error: accountError } = await supabase
        .from("x_bot_accounts")
        .insert({
          name: account.name || "New Account",
          username: account.username || "",
          email: account.email || null,
          password_encrypted: account.password_encrypted || null,
          totp_secret_encrypted: account.totp_secret_encrypted || null,
          full_cookie_encrypted: account.full_cookie_encrypted || null,
          auth_token_encrypted: account.auth_token_encrypted || null,
          ct0_token_encrypted: account.ct0_token_encrypted || null,
          proxy_url: account.proxy_url || null,
          socks5_urls: account.socks5_urls || [],
          current_socks5_index: 0,
          is_active: account.is_active ?? true,
        })
        .select()
        .single();

      if (accountError) throw accountError;

      // Create default rules
      const { error: rulesError } = await supabase.from("x_bot_account_rules").insert({
        account_id: newAccount.id,
        monitored_mentions: rules?.monitored_mentions || [],
        tracked_cashtags: rules?.tracked_cashtags || [],
        min_follower_count: rules?.min_follower_count || 5000,
        require_blue_verified: rules?.require_blue_verified ?? true,
        require_gold_verified: rules?.require_gold_verified ?? false,
        author_cooldown_hours: rules?.author_cooldown_hours || 6,
        max_replies_per_thread: rules?.max_replies_per_thread || 3,
        enabled: rules?.enabled ?? true,
      });

      if (rulesError) throw rulesError;

      toast({ title: "Account created successfully" });
      await fetchAccounts();
      return newAccount;
    } catch (error) {
      console.error("Error creating account:", error);
      toast({ title: "Failed to create account", variant: "destructive" });
      throw error;
    }
  };

  const updateAccount = async (id: string, account: Partial<XBotAccount>, rules?: Partial<XBotAccountRules>) => {
    try {
      const { error: accountError } = await supabase
        .from("x_bot_accounts")
        .update({
          name: account.name,
          username: account.username,
          email: account.email,
          password_encrypted: account.password_encrypted,
          totp_secret_encrypted: account.totp_secret_encrypted,
          full_cookie_encrypted: account.full_cookie_encrypted,
          auth_token_encrypted: account.auth_token_encrypted,
          ct0_token_encrypted: account.ct0_token_encrypted,
          proxy_url: account.proxy_url,
          socks5_urls: account.socks5_urls,
          is_active: account.is_active,
        })
        .eq("id", id);

      if (accountError) throw accountError;

      if (rules) {
        const { error: rulesError } = await supabase
          .from("x_bot_account_rules")
          .update({
            monitored_mentions: rules.monitored_mentions,
            tracked_cashtags: rules.tracked_cashtags,
            min_follower_count: rules.min_follower_count,
            require_blue_verified: rules.require_blue_verified,
            require_gold_verified: rules.require_gold_verified,
            author_cooldown_hours: rules.author_cooldown_hours,
            max_replies_per_thread: rules.max_replies_per_thread,
            enabled: rules.enabled,
          })
          .eq("account_id", id);

        if (rulesError) throw rulesError;
      }

      toast({ title: "Account updated successfully" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error updating account:", error);
      toast({ title: "Failed to update account", variant: "destructive" });
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase.from("x_bot_accounts").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Account deleted successfully" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({ title: "Failed to delete account", variant: "destructive" });
      throw error;
    }
  };

  const toggleAccountActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("x_bot_accounts")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      toast({ title: isActive ? "Account enabled" : "Account disabled" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error toggling account:", error);
      toast({ title: "Failed to toggle account", variant: "destructive" });
    }
  };

  const runScan = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (data.ok) {
        toast({ title: "Scan completed", description: `Queued ${data.debug?.queued || 0} tweets` });
      } else {
        toast({ title: "Scan failed", description: data.error || "Unknown error", variant: "destructive" });
      }
      await fetchQueue();
    } catch (error) {
      console.error("Error running scan:", error);
      toast({ title: "Scan failed", variant: "destructive" });
    }
  };

  const runReply = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (data.ok) {
        toast({ title: "Reply run completed", description: `Sent ${data.debug?.repliesSent || 0} replies` });
      } else {
        toast({ title: "Reply run failed", description: data.error || "Unknown error", variant: "destructive" });
      }
      await fetchReplies();
      await fetchQueue();
    } catch (error) {
      console.error("Error running reply:", error);
      toast({ title: "Reply run failed", variant: "destructive" });
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAccounts(), fetchReplies(), fetchQueue()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchAccounts, fetchReplies, fetchQueue]);

  return {
    accounts,
    replies,
    queue,
    loading,
    fetchAccounts,
    fetchReplies,
    fetchQueue,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleAccountActive,
    runScan,
    runReply,
  };
}
