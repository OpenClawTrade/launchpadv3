-- SECURITY FIX: Remove overly permissive token creation policies
-- Token creation should only happen through SECURITY DEFINER backend functions

-- 1. Drop the dangerous "Anyone can create fun tokens" policy
DROP POLICY IF EXISTS "Anyone can create fun tokens" ON public.fun_tokens;

-- 2. Drop the overly permissive "System can manage tokens" policy  
DROP POLICY IF EXISTS "System can manage tokens" ON public.tokens;

-- 3. Drop the overly permissive "Service can update fun tokens" policy
DROP POLICY IF EXISTS "Service can update fun tokens" ON public.fun_tokens;

-- 4. Create restrictive policies - NO public write access
-- All writes must go through backend_* SECURITY DEFINER functions

-- For tokens table: block all INSERT/UPDATE/DELETE through RLS
CREATE POLICY "Deny direct token writes"
ON public.tokens
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct token updates"
ON public.tokens
FOR UPDATE
USING (false);

CREATE POLICY "Deny direct token deletes"
ON public.tokens
FOR DELETE
USING (false);

-- For fun_tokens table: block all writes through RLS
CREATE POLICY "Deny direct fun_token writes"
ON public.fun_tokens
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct fun_token updates"
ON public.fun_tokens
FOR UPDATE
USING (false);

CREATE POLICY "Deny direct fun_token deletes"
ON public.fun_tokens
FOR DELETE
USING (false);

-- 5. Fix other dangerous "System can manage" policies
DROP POLICY IF EXISTS "System can manage api accounts" ON public.api_accounts;
DROP POLICY IF EXISTS "System can manage fee distributions" ON public.api_fee_distributions;
DROP POLICY IF EXISTS "System can manage launchpad tokens" ON public.api_launchpad_tokens;
DROP POLICY IF EXISTS "System can manage api launchpads" ON public.api_launchpads;
DROP POLICY IF EXISTS "System can manage usage logs" ON public.api_usage_logs;
DROP POLICY IF EXISTS "System can manage fee claims" ON public.fee_claims;
DROP POLICY IF EXISTS "System can manage fee earners" ON public.fee_earners;
DROP POLICY IF EXISTS "System can manage fee pool claims" ON public.fee_pool_claims;
DROP POLICY IF EXISTS "System can manage fun buybacks" ON public.fun_buybacks;
DROP POLICY IF EXISTS "System can manage fun fee claims" ON public.fun_fee_claims;
DROP POLICY IF EXISTS "System can manage token holdings" ON public.token_holdings;
DROP POLICY IF EXISTS "System can manage price history" ON public.token_price_history;
DROP POLICY IF EXISTS "System can manage trending topics" ON public.trending_topics;
DROP POLICY IF EXISTS "Service role full access" ON public.sniper_trades;

-- 6. Fix governance tables that allow anyone to insert
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.governance_conversations;
DROP POLICY IF EXISTS "Anyone can add messages" ON public.governance_messages;
DROP POLICY IF EXISTS "Anyone can create suggestions" ON public.governance_suggestions;

-- Create proper policies requiring authentication
CREATE POLICY "Authenticated users can create governance conversations"
ON public.governance_conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can add governance messages"
ON public.governance_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create governance suggestions"
ON public.governance_suggestions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Fix fun_distributions insert policy
DROP POLICY IF EXISTS "Service can create distributions" ON public.fun_distributions;

-- 8. Fix tracked_wallets overly permissive policies
DROP POLICY IF EXISTS "Users can create tracked wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can delete their tracked wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can update their tracked wallets" ON public.tracked_wallets;
DROP POLICY IF EXISTS "Users can view their own tracked wallets" ON public.tracked_wallets;

CREATE POLICY "Authenticated users can manage their tracked wallets"
ON public.tracked_wallets
FOR ALL
USING (auth.uid() = user_profile_id)
WITH CHECK (auth.uid() = user_profile_id);

-- 9. Fix DCA orders policies
DROP POLICY IF EXISTS "Users can create their own DCA orders" ON public.dca_orders;
DROP POLICY IF EXISTS "Users can delete their own DCA orders" ON public.dca_orders;
DROP POLICY IF EXISTS "Users can update their own DCA orders" ON public.dca_orders;
DROP POLICY IF EXISTS "Users can view their own DCA orders" ON public.dca_orders;

CREATE POLICY "Users can manage their own DCA orders"
ON public.dca_orders
FOR ALL
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);