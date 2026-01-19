-- Fix remaining overly permissive policies

-- 1. Fix hashtags - remove system manage, keep read access
DROP POLICY IF EXISTS "System can manage hashtags" ON public.hashtags;

-- 2. Fix launchpad_transactions - remove system manage
DROP POLICY IF EXISTS "System can manage launchpad transactions" ON public.launchpad_transactions;

-- 3. Fix user_ip_logs - remove system manage (admin policies already exist)
DROP POLICY IF EXISTS "System can manage ip logs" ON public.user_ip_logs;

-- 4. Fix limit_orders - keep only the new proper policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.limit_orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.limit_orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.limit_orders;

-- 5. Add policies for tables with no policies
-- api_usage_logs should only be viewable/manageable by system (backend functions)
CREATE POLICY "Deny direct access to api_usage_logs"
ON public.api_usage_logs
FOR ALL
USING (false);

-- sniper_trades should only be manageable by backend
CREATE POLICY "Deny direct access to sniper_trades" 
ON public.sniper_trades
FOR ALL
USING (false);