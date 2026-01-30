export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_accounts: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          fee_wallet_address: string
          id: string
          status: string
          terms_accepted_at: string | null
          total_fees_earned: number | null
          total_fees_paid_out: number | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          fee_wallet_address: string
          id?: string
          status?: string
          terms_accepted_at?: string | null
          total_fees_earned?: number | null
          total_fees_paid_out?: number | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          fee_wallet_address?: string
          id?: string
          status?: string
          terms_accepted_at?: string | null
          total_fees_earned?: number | null
          total_fees_paid_out?: number | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      api_fee_distributions: {
        Row: {
          api_account_id: string
          api_user_share: number
          created_at: string | null
          distributed_at: string | null
          id: string
          launchpad_id: string | null
          platform_share: number
          signature: string | null
          status: string
          token_id: string | null
          total_fee_sol: number
        }
        Insert: {
          api_account_id: string
          api_user_share?: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          launchpad_id?: string | null
          platform_share?: number
          signature?: string | null
          status?: string
          token_id?: string | null
          total_fee_sol?: number
        }
        Update: {
          api_account_id?: string
          api_user_share?: number
          created_at?: string | null
          distributed_at?: string | null
          id?: string
          launchpad_id?: string | null
          platform_share?: number
          signature?: string | null
          status?: string
          token_id?: string | null
          total_fee_sol?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_fee_distributions_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_fee_distributions_launchpad_id_fkey"
            columns: ["launchpad_id"]
            isOneToOne: false
            referencedRelation: "api_launchpads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_fee_distributions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_launchpad_tokens: {
        Row: {
          created_at: string | null
          id: string
          launchpad_id: string
          token_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          launchpad_id: string
          token_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          launchpad_id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_launchpad_tokens_launchpad_id_fkey"
            columns: ["launchpad_id"]
            isOneToOne: false
            referencedRelation: "api_launchpads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_launchpad_tokens_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_launchpads: {
        Row: {
          api_account_id: string
          cloudflare_record_id: string | null
          created_at: string | null
          custom_domain: string | null
          deployed_at: string | null
          design_config: Json | null
          id: string
          name: string
          status: string
          subdomain: string | null
          total_fees_sol: number | null
          total_volume_sol: number | null
          updated_at: string | null
          vercel_deployment_url: string | null
          vercel_project_id: string | null
        }
        Insert: {
          api_account_id: string
          cloudflare_record_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deployed_at?: string | null
          design_config?: Json | null
          id?: string
          name: string
          status?: string
          subdomain?: string | null
          total_fees_sol?: number | null
          total_volume_sol?: number | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Update: {
          api_account_id?: string
          cloudflare_record_id?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deployed_at?: string | null
          design_config?: Json | null
          id?: string
          name?: string
          status?: string
          subdomain?: string | null
          total_fees_sol?: number | null
          total_volume_sol?: number | null
          updated_at?: string | null
          vercel_deployment_url?: string | null
          vercel_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_launchpads_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          api_account_id: string
          created_at: string | null
          endpoint: string
          id: string
          method: string
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_account_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_account_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_account_id_fkey"
            columns: ["api_account_id"]
            isOneToOne: false
            referencedRelation: "api_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          members_count: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          members_count?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          members_count?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          participant_1: string
          participant_2: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1: string
          participant_2: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          participant_1?: string
          participant_2?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_trade_executions: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          signature: string | null
          sol_amount: number
          status: string
          token_amount: number
          tracked_wallet_id: string
          user_profile_id: string
          user_wallet: string
          wallet_trade_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          signature?: string | null
          sol_amount: number
          status?: string
          token_amount: number
          tracked_wallet_id: string
          user_profile_id: string
          user_wallet: string
          wallet_trade_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          signature?: string | null
          sol_amount?: number
          status?: string
          token_amount?: number
          tracked_wallet_id?: string
          user_profile_id?: string
          user_wallet?: string
          wallet_trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_trade_executions_tracked_wallet_id_fkey"
            columns: ["tracked_wallet_id"]
            isOneToOne: false
            referencedRelation: "tracked_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_executions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_trade_executions_wallet_trade_id_fkey"
            columns: ["wallet_trade_id"]
            isOneToOne: false
            referencedRelation: "wallet_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          lock_name: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          lock_name: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          lock_name?: string
        }
        Relationships: []
      }
      dca_orders: {
        Row: {
          amount_per_order: number
          created_at: string
          id: string
          interval_seconds: number
          next_execution_at: string | null
          orders_executed: number
          profile_id: string | null
          side: string
          slippage_bps: number | null
          status: string
          token_id: string
          total_orders: number
          updated_at: string
          user_wallet: string
        }
        Insert: {
          amount_per_order: number
          created_at?: string
          id?: string
          interval_seconds: number
          next_execution_at?: string | null
          orders_executed?: number
          profile_id?: string | null
          side: string
          slippage_bps?: number | null
          status?: string
          token_id: string
          total_orders: number
          updated_at?: string
          user_wallet: string
        }
        Update: {
          amount_per_order?: number
          created_at?: string
          id?: string
          interval_seconds?: number
          next_execution_at?: string | null
          orders_executed?: number
          profile_id?: string | null
          side?: string
          slippage_bps?: number | null
          status?: string
          token_id?: string
          total_orders?: number
          updated_at?: string
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "dca_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dca_orders_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          client_ip: string | null
          created_at: string | null
          id: string
          logs: Json
          session_id: string
        }
        Insert: {
          client_ip?: string | null
          created_at?: string | null
          id?: string
          logs: Json
          session_id: string
        }
        Update: {
          client_ip?: string | null
          created_at?: string | null
          id?: string
          logs?: Json
          session_id?: string
        }
        Relationships: []
      }
      fee_claims: {
        Row: {
          amount_sol: number
          created_at: string | null
          fee_earner_id: string
          id: string
          signature: string
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          fee_earner_id: string
          id?: string
          signature: string
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          fee_earner_id?: string
          id?: string
          signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_claims_fee_earner_id_fkey"
            columns: ["fee_earner_id"]
            isOneToOne: false
            referencedRelation: "fee_earners"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_earners: {
        Row: {
          created_at: string | null
          earner_type: string
          id: string
          last_claimed_at: string | null
          profile_id: string | null
          share_bps: number
          token_id: string
          total_earned_sol: number | null
          twitter_handle: string | null
          unclaimed_sol: number | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string | null
          earner_type: string
          id?: string
          last_claimed_at?: string | null
          profile_id?: string | null
          share_bps?: number
          token_id: string
          total_earned_sol?: number | null
          twitter_handle?: string | null
          unclaimed_sol?: number | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string | null
          earner_type?: string
          id?: string
          last_claimed_at?: string | null
          profile_id?: string | null
          share_bps?: number
          token_id?: string
          total_earned_sol?: number | null
          twitter_handle?: string | null
          unclaimed_sol?: number | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_earners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_earners_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_pool_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number | null
          created_at: string | null
          id: string
          pool_address: string
          processed: boolean | null
          processed_at: string | null
          signature: string
          token_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          id?: string
          pool_address: string
          processed?: boolean | null
          processed_at?: string | null
          signature: string
          token_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number | null
          created_at?: string | null
          id?: string
          pool_address?: string
          processed?: boolean | null
          processed_at?: string | null
          signature?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_pool_claims_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_buybacks: {
        Row: {
          amount_sol: number
          created_at: string | null
          fun_token_id: string | null
          id: string
          signature: string | null
          status: string | null
          tokens_bought: number | null
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          tokens_bought?: number | null
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
          tokens_bought?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_buybacks_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_distributions: {
        Row: {
          amount_sol: number
          created_at: string | null
          creator_wallet: string
          distribution_type: string | null
          fun_token_id: string | null
          id: string
          signature: string | null
          status: string | null
        }
        Insert: {
          amount_sol: number
          created_at?: string | null
          creator_wallet: string
          distribution_type?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string | null
          creator_wallet?: string
          distribution_type?: string | null
          fun_token_id?: string | null
          id?: string
          signature?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_distributions_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number
          created_at: string | null
          creator_distributed: boolean | null
          creator_distribution_id: string | null
          fun_token_id: string | null
          id: string
          pool_address: string
          signature: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address: string
          signature?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number
          created_at?: string | null
          creator_distributed?: boolean | null
          creator_distribution_id?: string | null
          fun_token_id?: string | null
          id?: string
          pool_address?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_fee_claims_creator_distribution_id_fkey"
            columns: ["creator_distribution_id"]
            isOneToOne: false
            referencedRelation: "fun_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fun_fee_claims_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_token_jobs: {
        Row: {
          client_ip: string | null
          completed_at: string | null
          created_at: string | null
          creator_wallet: string
          dbc_pool_address: string | null
          description: string | null
          error_message: string | null
          fun_token_id: string | null
          id: string
          image_url: string | null
          mint_address: string | null
          name: string
          status: string
          ticker: string
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_wallet: string
          dbc_pool_address?: string | null
          description?: string | null
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          image_url?: string | null
          mint_address?: string | null
          name: string
          status?: string
          ticker: string
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          client_ip?: string | null
          completed_at?: string | null
          created_at?: string | null
          creator_wallet?: string
          dbc_pool_address?: string | null
          description?: string | null
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          image_url?: string | null
          mint_address?: string | null
          name?: string
          status?: string
          ticker?: string
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      fun_tokens: {
        Row: {
          bonding_progress: number | null
          created_at: string | null
          creator_wallet: string
          dbc_pool_address: string | null
          description: string | null
          discord_url: string | null
          holder_count: number | null
          id: string
          image_url: string | null
          last_distribution_at: string | null
          market_cap_sol: number | null
          mint_address: string | null
          name: string
          price_24h_ago: number | null
          price_change_24h: number | null
          price_sol: number | null
          status: string | null
          telegram_url: string | null
          ticker: string
          total_fees_earned: number | null
          twitter_url: string | null
          updated_at: string | null
          volume_24h_sol: number | null
          website_url: string | null
        }
        Insert: {
          bonding_progress?: number | null
          created_at?: string | null
          creator_wallet: string
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_distribution_at?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker: string
          total_fees_earned?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Update: {
          bonding_progress?: number | null
          created_at?: string | null
          creator_wallet?: string
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_distribution_at?: string | null
          market_cap_sol?: number | null
          mint_address?: string | null
          name?: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          status?: string | null
          telegram_url?: string | null
          ticker?: string
          total_fees_earned?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      governance_conversations: {
        Row: {
          id: string
          is_holder: boolean | null
          last_message_at: string
          message_count: number
          started_at: string
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          id?: string
          is_holder?: boolean | null
          last_message_at?: string
          message_count?: number
          started_at?: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          id?: string
          is_holder?: boolean | null
          last_message_at?: string
          message_count?: number
          started_at?: string
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "governance_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_suggestions: {
        Row: {
          category: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggestion_text: string
          user_id: string | null
          votes_against: number
          votes_for: number
          wallet_address: string | null
        }
        Insert: {
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text: string
          user_id?: string | null
          votes_against?: number
          votes_for?: number
          wallet_address?: string | null
        }
        Update: {
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggestion_text?: string
          user_id?: string | null
          votes_against?: number
          votes_for?: number
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "governance_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "governance_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          post_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          post_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          post_count?: number | null
        }
        Relationships: []
      }
      ip_bans: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string
          reason: string | null
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
        }
        Relationships: []
      }
      launch_rate_limits: {
        Row: {
          id: string
          ip_address: string
          launched_at: string
          token_id: string | null
        }
        Insert: {
          id?: string
          ip_address: string
          launched_at?: string
          token_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string
          launched_at?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_rate_limits_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      launchpad_transactions: {
        Row: {
          created_at: string | null
          creator_fee_sol: number | null
          id: string
          price_per_token: number
          signature: string
          slot: number | null
          sol_amount: number
          system_fee_sol: number | null
          token_amount: number
          token_id: string
          transaction_type: string
          user_profile_id: string | null
          user_wallet: string
        }
        Insert: {
          created_at?: string | null
          creator_fee_sol?: number | null
          id?: string
          price_per_token: number
          signature: string
          slot?: number | null
          sol_amount: number
          system_fee_sol?: number | null
          token_amount: number
          token_id: string
          transaction_type: string
          user_profile_id?: string | null
          user_wallet: string
        }
        Update: {
          created_at?: string | null
          creator_fee_sol?: number | null
          id?: string
          price_per_token?: number
          signature?: string
          slot?: number | null
          sol_amount?: number
          system_fee_sol?: number | null
          token_amount?: number
          token_id?: string
          transaction_type?: string
          user_profile_id?: string | null
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "launchpad_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launchpad_transactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      limit_orders: {
        Row: {
          amount: number
          amount_type: string
          created_at: string
          executed_at: string | null
          executed_signature: string | null
          expires_at: string | null
          id: string
          order_type: string
          profile_id: string | null
          side: string
          slippage_bps: number | null
          status: string
          token_id: string
          trigger_price: number
          updated_at: string
          user_wallet: string
        }
        Insert: {
          amount: number
          amount_type?: string
          created_at?: string
          executed_at?: string | null
          executed_signature?: string | null
          expires_at?: string | null
          id?: string
          order_type: string
          profile_id?: string | null
          side: string
          slippage_bps?: number | null
          status?: string
          token_id: string
          trigger_price: number
          updated_at?: string
          user_wallet: string
        }
        Update: {
          amount?: number
          amount_type?: string
          created_at?: string
          executed_at?: string | null
          executed_signature?: string | null
          expires_at?: string | null
          id?: string
          order_type?: string
          profile_id?: string | null
          side?: string
          slippage_bps?: number | null
          status?: string
          token_id?: string
          trigger_price?: number
          updated_at?: string
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "limit_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limit_orders_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          read: boolean | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_history: {
        Row: {
          created_at: string
          description: string | null
          example_tokens: string[] | null
          id: string
          narrative: string
          popularity_score: number | null
          snapshot_at: string
          token_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          narrative: string
          popularity_score?: number | null
          snapshot_at?: string
          token_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          narrative?: string
          popularity_score?: number | null
          snapshot_at?: string
          token_count?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          content: string | null
          created_at: string
          id: string
          post_id: string | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          content?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_token_metadata: {
        Row: {
          created_at: string
          creator_wallet: string | null
          description: string | null
          discord_url: string | null
          expires_at: string | null
          image_url: string | null
          mint_address: string
          name: string
          telegram_url: string | null
          ticker: string
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          creator_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          expires_at?: string | null
          image_url?: string | null
          mint_address: string
          name: string
          telegram_url?: string | null
          ticker: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          creator_wallet?: string | null
          description?: string | null
          discord_url?: string | null
          expires_at?: string | null
          image_url?: string | null
          mint_address?: string
          name?: string
          telegram_url?: string | null
          ticker?: string
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      pool_state_cache: {
        Row: {
          bonding_progress: number | null
          holder_count: number | null
          is_graduated: boolean | null
          market_cap_sol: number | null
          mint_address: string | null
          pool_address: string
          price_sol: number | null
          real_sol_reserves: number | null
          updated_at: string | null
          virtual_sol_reserves: number | null
          virtual_token_reserves: number | null
        }
        Insert: {
          bonding_progress?: number | null
          holder_count?: number | null
          is_graduated?: boolean | null
          market_cap_sol?: number | null
          mint_address?: string | null
          pool_address: string
          price_sol?: number | null
          real_sol_reserves?: number | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
        }
        Update: {
          bonding_progress?: number | null
          holder_count?: number | null
          is_graduated?: boolean | null
          market_cap_sol?: number | null
          mint_address?: string | null
          pool_address?: string
          price_sol?: number | null
          real_sol_reserves?: number | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_repost: boolean | null
          likes_count: number | null
          original_post_id: string | null
          parent_id: string | null
          pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
          replies_count: number | null
          reposts_count: number | null
          short_id: string | null
          updated_at: string
          user_id: string
          views_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean | null
          likes_count?: number | null
          original_post_id?: string | null
          parent_id?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          replies_count?: number | null
          reposts_count?: number | null
          short_id?: string | null
          updated_at?: string
          user_id: string
          views_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean | null
          likes_count?: number | null
          original_post_id?: string | null
          parent_id?: string | null
          pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
          replies_count?: number | null
          reposts_count?: number | null
          short_id?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          followers_count: number | null
          following_count: number | null
          id: string
          location: string | null
          posts_count: number | null
          solana_wallet_address: string | null
          updated_at: string
          username: string
          username_changed_at: string | null
          verified_type: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          followers_count?: number | null
          following_count?: number | null
          id: string
          location?: string | null
          posts_count?: number | null
          solana_wallet_address?: string | null
          updated_at?: string
          username: string
          username_changed_at?: string | null
          verified_type?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          location?: string | null
          posts_count?: number | null
          solana_wallet_address?: string | null
          updated_at?: string
          username?: string
          username_changed_at?: string | null
          verified_type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_post_id: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sniper_trades: {
        Row: {
          bought_at: string | null
          buy_amount_sol: number
          buy_signature: string | null
          buy_slot: number | null
          created_at: string
          error_message: string | null
          fun_token_id: string | null
          id: string
          mint_address: string
          pool_address: string
          scheduled_sell_at: string | null
          sell_signature: string | null
          sell_slot: number | null
          sol_received: number | null
          sold_at: string | null
          status: string
          token_id: string | null
          tokens_received: number | null
        }
        Insert: {
          bought_at?: string | null
          buy_amount_sol?: number
          buy_signature?: string | null
          buy_slot?: number | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address: string
          pool_address: string
          scheduled_sell_at?: string | null
          sell_signature?: string | null
          sell_slot?: number | null
          sol_received?: number | null
          sold_at?: string | null
          status?: string
          token_id?: string | null
          tokens_received?: number | null
        }
        Update: {
          bought_at?: string | null
          buy_amount_sol?: number
          buy_signature?: string | null
          buy_slot?: number | null
          created_at?: string
          error_message?: string | null
          fun_token_id?: string | null
          id?: string
          mint_address?: string
          pool_address?: string
          scheduled_sell_at?: string | null
          sell_signature?: string | null
          sell_slot?: number | null
          sol_received?: number | null
          sold_at?: string | null
          status?: string
          token_id?: string | null
          tokens_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sniper_trades_fun_token_id_fkey"
            columns: ["fun_token_id"]
            isOneToOne: false
            referencedRelation: "fun_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sniper_trades_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number | null
          parent_id: string | null
          token_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          token_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          token_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "token_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_comments_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      token_holdings: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          profile_id: string | null
          token_id: string
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          token_id: string
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          profile_id?: string | null
          token_id?: string
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holdings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_price_history: {
        Row: {
          created_at: string
          id: string
          interval_type: string
          market_cap_sol: number
          price_sol: number
          timestamp: string
          token_id: string
          volume_sol: number
        }
        Insert: {
          created_at?: string
          id?: string
          interval_type?: string
          market_cap_sol?: number
          price_sol: number
          timestamp?: string
          token_id: string
          volume_sol?: number
        }
        Update: {
          created_at?: string
          id?: string
          interval_type?: string
          market_cap_sol?: number
          price_sol?: number
          timestamp?: string
          token_id?: string
          volume_sol?: number
        }
        Relationships: [
          {
            foreignKeyName: "token_price_history_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          bonding_curve_progress: number | null
          claim_locked_at: string | null
          created_at: string | null
          creator_fee_bps: number | null
          creator_id: string | null
          creator_wallet: string
          damm_pool_address: string | null
          dbc_pool_address: string | null
          description: string | null
          discord_url: string | null
          graduated_at: string | null
          graduation_threshold_sol: number | null
          holder_count: number | null
          id: string
          image_url: string | null
          last_claim_at: string | null
          market_cap_sol: number | null
          migration_status: string | null
          mint_address: string
          name: string
          price_24h_ago: number | null
          price_change_24h: number | null
          price_sol: number | null
          quote_decimals: number | null
          quote_token: string | null
          real_sol_reserves: number | null
          real_token_reserves: number | null
          status: string | null
          system_fee_bps: number | null
          system_unclaimed_sol: number | null
          telegram_url: string | null
          ticker: string
          total_supply: number | null
          twitter_url: string | null
          updated_at: string | null
          virtual_sol_reserves: number | null
          virtual_token_reserves: number | null
          volume_24h_sol: number | null
          website_url: string | null
        }
        Insert: {
          bonding_curve_progress?: number | null
          claim_locked_at?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_id?: string | null
          creator_wallet: string
          damm_pool_address?: string | null
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          graduated_at?: string | null
          graduation_threshold_sol?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_claim_at?: string | null
          market_cap_sol?: number | null
          migration_status?: string | null
          mint_address: string
          name: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          quote_decimals?: number | null
          quote_token?: string | null
          real_sol_reserves?: number | null
          real_token_reserves?: number | null
          status?: string | null
          system_fee_bps?: number | null
          system_unclaimed_sol?: number | null
          telegram_url?: string | null
          ticker: string
          total_supply?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Update: {
          bonding_curve_progress?: number | null
          claim_locked_at?: string | null
          created_at?: string | null
          creator_fee_bps?: number | null
          creator_id?: string | null
          creator_wallet?: string
          damm_pool_address?: string | null
          dbc_pool_address?: string | null
          description?: string | null
          discord_url?: string | null
          graduated_at?: string | null
          graduation_threshold_sol?: number | null
          holder_count?: number | null
          id?: string
          image_url?: string | null
          last_claim_at?: string | null
          market_cap_sol?: number | null
          migration_status?: string | null
          mint_address?: string
          name?: string
          price_24h_ago?: number | null
          price_change_24h?: number | null
          price_sol?: number | null
          quote_decimals?: number | null
          quote_token?: string | null
          real_sol_reserves?: number | null
          real_token_reserves?: number | null
          status?: string | null
          system_fee_bps?: number | null
          system_unclaimed_sol?: number | null
          telegram_url?: string | null
          ticker?: string
          total_supply?: number | null
          twitter_url?: string | null
          updated_at?: string | null
          virtual_sol_reserves?: number | null
          virtual_token_reserves?: number | null
          volume_24h_sol?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_wallets: {
        Row: {
          copy_amount_sol: number | null
          copy_percentage: number | null
          created_at: string
          id: string
          is_copy_trading_enabled: boolean
          max_per_trade_sol: number | null
          notifications_enabled: boolean
          total_pnl_sol: number | null
          trades_copied: number | null
          updated_at: string
          user_profile_id: string
          wallet_address: string
          wallet_label: string | null
        }
        Insert: {
          copy_amount_sol?: number | null
          copy_percentage?: number | null
          created_at?: string
          id?: string
          is_copy_trading_enabled?: boolean
          max_per_trade_sol?: number | null
          notifications_enabled?: boolean
          total_pnl_sol?: number | null
          trades_copied?: number | null
          updated_at?: string
          user_profile_id: string
          wallet_address: string
          wallet_label?: string | null
        }
        Update: {
          copy_amount_sol?: number | null
          copy_percentage?: number | null
          created_at?: string
          id?: string
          is_copy_trading_enabled?: boolean
          max_per_trade_sol?: number | null
          notifications_enabled?: boolean
          total_pnl_sol?: number | null
          trades_copied?: number | null
          updated_at?: string
          user_profile_id?: string
          wallet_address?: string
          wallet_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_wallets_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_fee_claims: {
        Row: {
          claimed_at: string | null
          claimed_sol: number
          id: string
          is_registered: boolean | null
          mint_address: string | null
          pool_address: string
          signature: string | null
          token_name: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_sol?: number
          id?: string
          is_registered?: boolean | null
          mint_address?: string | null
          pool_address: string
          signature?: string | null
          token_name?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_sol?: number
          id?: string
          is_registered?: boolean | null
          mint_address?: string | null
          pool_address?: string
          signature?: string | null
          token_name?: string | null
        }
        Relationships: []
      }
      trending_narratives: {
        Row: {
          analyzed_at: string
          created_at: string
          description: string | null
          example_tokens: string[] | null
          id: string
          is_active: boolean
          narrative: string
          popularity_score: number
          token_count: number
        }
        Insert: {
          analyzed_at?: string
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          is_active?: boolean
          narrative: string
          popularity_score?: number
          token_count?: number
        }
        Update: {
          analyzed_at?: string
          created_at?: string
          description?: string | null
          example_tokens?: string[] | null
          id?: string
          is_active?: boolean
          narrative?: string
          popularity_score?: number
          token_count?: number
        }
        Relationships: []
      }
      trending_tokens: {
        Row: {
          amount: number | null
          chain_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string | null
          rank: number
          symbol: string | null
          synced_at: string
          token_address: string
          total_amount: number | null
          url: string | null
        }
        Insert: {
          amount?: number | null
          chain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          rank: number
          symbol?: string | null
          synced_at?: string
          token_address: string
          total_amount?: number | null
          url?: string | null
        }
        Update: {
          amount?: number | null
          chain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          rank?: number
          symbol?: string | null
          synced_at?: string
          token_address?: string
          total_amount?: number | null
          url?: string | null
        }
        Relationships: []
      }
      trending_topics: {
        Row: {
          calculated_at: string | null
          category: string | null
          hashtag_id: string | null
          id: string
          post_count_1h: number | null
          post_count_24h: number | null
          rank: number | null
          score: number
          velocity: number | null
        }
        Insert: {
          calculated_at?: string | null
          category?: string | null
          hashtag_id?: string | null
          id?: string
          post_count_1h?: number | null
          post_count_24h?: number | null
          rank?: number | null
          score?: number
          velocity?: number | null
        }
        Update: {
          calculated_at?: string | null
          category?: string | null
          hashtag_id?: string | null
          id?: string
          post_count_1h?: number | null
          post_count_24h?: number | null
          rank?: number | null
          score?: number
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_topics_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      twitter_bot_replies: {
        Row: {
          created_at: string
          id: string
          reply_id: string | null
          reply_text: string
          tweet_author: string | null
          tweet_id: string
          tweet_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id?: string | null
          reply_text: string
          tweet_author?: string | null
          tweet_id: string
          tweet_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string | null
          reply_text?: string
          tweet_author?: string | null
          tweet_id?: string
          tweet_text?: string | null
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          associated_ips: string[] | null
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          associated_ips?: string[] | null
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          associated_ips?: string[] | null
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ip_logs: {
        Row: {
          first_seen_at: string
          id: string
          ip_address: string
          last_seen_at: string
          request_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          ip_address: string
          last_seen_at?: string
          request_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          ip_address?: string
          last_seen_at?: string
          request_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_mutes: {
        Row: {
          created_at: string
          id: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vanity_keypairs: {
        Row: {
          created_at: string
          id: string
          public_key: string
          secret_key_encrypted: string
          status: string
          suffix: string
          used_for_token_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          public_key: string
          secret_key_encrypted: string
          status?: string
          suffix: string
          used_for_token_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          public_key?: string
          secret_key_encrypted?: string
          status?: string
          suffix?: string
          used_for_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vanity_keypairs_used_for_token_id_fkey"
            columns: ["used_for_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_trades: {
        Row: {
          copied_by_count: number | null
          created_at: string
          id: string
          price_per_token: number
          signature: string
          slot: number | null
          sol_amount: number
          token_amount: number
          token_mint: string
          token_name: string | null
          token_ticker: string | null
          tracked_wallet_id: string | null
          trade_type: string
          wallet_address: string
        }
        Insert: {
          copied_by_count?: number | null
          created_at?: string
          id?: string
          price_per_token: number
          signature: string
          slot?: number | null
          sol_amount: number
          token_amount: number
          token_mint: string
          token_name?: string | null
          token_ticker?: string | null
          tracked_wallet_id?: string | null
          trade_type: string
          wallet_address: string
        }
        Update: {
          copied_by_count?: number | null
          created_at?: string
          id?: string
          price_per_token?: number
          signature?: string
          slot?: number | null
          sol_amount?: number
          token_amount?: number
          token_mint?: string
          token_name?: string | null
          token_ticker?: string | null
          tracked_wallet_id?: string | null
          trade_type?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_trades_tracked_wallet_id_fkey"
            columns: ["tracked_wallet_id"]
            isOneToOne: false
            referencedRelation: "tracked_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      x_bot_rate_limits: {
        Row: {
          id: string
          launched_at: string
          x_user_id: string
          x_username: string | null
        }
        Insert: {
          id?: string
          launched_at?: string
          x_user_id: string
          x_username?: string | null
        }
        Update: {
          id?: string
          launched_at?: string
          x_user_id?: string
          x_username?: string | null
        }
        Relationships: []
      }
      x_pending_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          original_tweet_image_url: string | null
          original_tweet_text: string | null
          our_reply_tweet_id: string | null
          status: string
          tweet_id: string
          x_user_id: string
          x_username: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          original_tweet_image_url?: string | null
          original_tweet_text?: string | null
          our_reply_tweet_id?: string | null
          status?: string
          tweet_id: string
          x_user_id: string
          x_username?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          original_tweet_image_url?: string | null
          original_tweet_text?: string | null
          our_reply_tweet_id?: string | null
          status?: string
          tweet_id?: string
          x_user_id?: string
          x_username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_reports_view: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          post_author_username: string | null
          post_content: string | null
          reason: string | null
          reported_display_name: string | null
          reported_post_id: string | null
          reported_user_id: string | null
          reported_username: string | null
          reporter_display_name: string | null
          reporter_id: string | null
          reporter_username: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_claim_lock: {
        Args: { p_lock_duration_seconds?: number; p_token_id: string }
        Returns: boolean
      }
      backend_complete_token_job: {
        Args: {
          p_dbc_pool_address: string
          p_fun_token_id: string
          p_job_id: string
          p_mint_address: string
        }
        Returns: undefined
      }
      backend_create_api_account: {
        Args: {
          p_api_key_hash: string
          p_api_key_prefix: string
          p_fee_wallet_address?: string
          p_wallet_address: string
        }
        Returns: string
      }
      backend_create_fee_earner: {
        Args: {
          p_earner_type: string
          p_profile_id?: string
          p_share_bps: number
          p_token_id: string
          p_twitter_handle?: string
          p_wallet_address?: string
        }
        Returns: string
      }
      backend_create_sniper_trade: {
        Args: {
          p_buy_amount_sol?: number
          p_fun_token_id?: string
          p_mint_address?: string
          p_pool_address?: string
          p_token_id?: string
        }
        Returns: string
      }
      backend_create_system_post: {
        Args: { p_content: string; p_image_url?: string; p_user_id: string }
        Returns: string
      }
      backend_create_token: {
        Args: {
          p_creator_fee_bps?: number
          p_creator_id?: string
          p_creator_wallet: string
          p_dbc_pool_address?: string
          p_description?: string
          p_discord_url?: string
          p_graduation_threshold_sol?: number
          p_id: string
          p_image_url?: string
          p_market_cap_sol?: number
          p_mint_address: string
          p_name: string
          p_price_sol?: number
          p_real_sol_reserves?: number
          p_real_token_reserves?: number
          p_system_fee_bps?: number
          p_telegram_url?: string
          p_ticker: string
          p_total_supply?: number
          p_twitter_url?: string
          p_virtual_sol_reserves?: number
          p_virtual_token_reserves?: number
          p_website_url?: string
        }
        Returns: string
      }
      backend_create_token_job: {
        Args: {
          p_client_ip?: string
          p_creator_wallet: string
          p_description?: string
          p_image_url?: string
          p_name: string
          p_ticker: string
          p_twitter_url?: string
          p_website_url?: string
        }
        Returns: string
      }
      backend_fail_sniper_trade: {
        Args: { p_error_message: string; p_id: string }
        Returns: undefined
      }
      backend_fail_token_job: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: undefined
      }
      backend_get_recent_vanity_keypairs: {
        Args: { p_limit?: number; p_suffix?: string }
        Returns: {
          created_at: string
          id: string
          public_key: string
          status: string
          suffix: string
          used_for_token_id: string
        }[]
      }
      backend_get_used_vanity_keypairs: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          id: string
          mint_address: string
          public_key: string
          suffix: string
          token_id: string
          token_name: string
          token_ticker: string
        }[]
      }
      backend_get_vanity_stats: {
        Args: { p_suffix?: string }
        Returns: {
          available: number
          reserved: number
          total: number
          used: number
        }[]
      }
      backend_get_vanity_suffixes: {
        Args: never
        Returns: {
          count: number
          suffix: string
        }[]
      }
      backend_insert_treasury_claim: {
        Args: {
          p_claimed_sol?: number
          p_is_registered?: boolean
          p_mint_address?: string
          p_pool_address: string
          p_signature?: string
          p_token_name?: string
        }
        Returns: string
      }
      backend_insert_vanity_keypair: {
        Args: {
          p_public_key: string
          p_secret_key_encrypted: string
          p_suffix: string
        }
        Returns: string
      }
      backend_mark_vanity_used: {
        Args: { p_keypair_id: string; p_token_id: string }
        Returns: undefined
      }
      backend_record_transaction: {
        Args: {
          p_creator_fee_sol?: number
          p_price_per_token: number
          p_signature: string
          p_slot?: number
          p_sol_amount: number
          p_system_fee_sol?: number
          p_token_amount: number
          p_token_id: string
          p_transaction_type: string
          p_user_profile_id?: string
          p_user_wallet: string
        }
        Returns: string
      }
      backend_release_vanity_address: {
        Args: { p_keypair_id: string }
        Returns: undefined
      }
      backend_reserve_vanity_address: {
        Args: { p_suffix: string }
        Returns: {
          id: string
          public_key: string
          secret_key_encrypted: string
        }[]
      }
      backend_update_fee_earner: {
        Args: {
          p_earner_type: string
          p_fee_amount: number
          p_token_id: string
        }
        Returns: undefined
      }
      backend_update_holder_count: {
        Args: { p_token_id: string }
        Returns: undefined
      }
      backend_update_sniper_buy: {
        Args: {
          p_buy_signature: string
          p_buy_slot?: number
          p_id: string
          p_tokens_received?: number
        }
        Returns: undefined
      }
      backend_update_sniper_sell: {
        Args: {
          p_id: string
          p_sell_signature: string
          p_sell_slot?: number
          p_sol_received?: number
        }
        Returns: undefined
      }
      backend_update_token_state: {
        Args: {
          p_bonding_curve_progress: number
          p_market_cap_sol: number
          p_price_sol: number
          p_real_sol_reserves: number
          p_real_token_reserves: number
          p_token_id: string
          p_virtual_sol_reserves: number
          p_virtual_token_reserves: number
          p_volume_delta?: number
        }
        Returns: undefined
      }
      backend_upsert_token_holding: {
        Args: {
          p_balance_delta: number
          p_profile_id?: string
          p_token_id: string
          p_wallet_address: string
        }
        Returns: undefined
      }
      calculate_trending_topics: { Args: never; Returns: undefined }
      can_pin_posts: { Args: { _user_id: string }; Returns: boolean }
      cleanup_old_bot_replies: { Args: never; Returns: undefined }
      cleanup_old_debug_logs: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      generate_short_id: { Args: never; Returns: string }
      get_api_account_by_wallet: {
        Args: { p_wallet_address: string }
        Returns: {
          api_key_prefix: string
          created_at: string
          fee_wallet_address: string
          id: string
          status: string
          total_fees_earned: number
          total_fees_paid_out: number
          wallet_address: string
        }[]
      }
      get_fun_fee_claims_summary: {
        Args: never
        Returns: {
          claim_count: number
          total_claimed_sol: number
        }[]
      }
      get_suggested_users: {
        Args: { current_user_id: string; limit_count?: number }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          followers_count: number
          id: string
          suggestion_score: number
          username: string
          verified_type: string
        }[]
      }
      get_treasury_claims_summary: {
        Args: never
        Returns: {
          claim_count: number
          total_claimed_sol: number
        }[]
      }
      get_user_ips: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_ip_banned: { Args: { _ip_address: string }; Returns: boolean }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      release_claim_lock: { Args: { p_token_id: string }; Returns: undefined }
      snapshot_fun_token_prices: { Args: never; Returns: undefined }
      update_token_24h_stats: { Args: never; Returns: undefined }
      verify_api_key: {
        Args: { p_api_key_hash: string }
        Returns: {
          id: string
          status: string
          wallet_address: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
