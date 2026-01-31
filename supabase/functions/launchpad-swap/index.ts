import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-launchpad-id",
};

const PLATFORM_FEE_WALLET = "FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r";
const FEE_BPS = 200; // 2% fee
const API_USER_FEE_SHARE = 0.75; // 1.5% to API user (75% of 2%)
const PLATFORM_FEE_SHARE = 0.25; // 0.5% to platform (25% of 2%)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress, userWallet, amount, isBuy, privyUserId, profileId, signature: clientSignature } = await req.json();
    
    // Check if this trade is from an API launchpad
    const launchpadId = req.headers.get("x-launchpad-id");
    const apiKey = req.headers.get("x-api-key");

    console.log("[launchpad-swap] Request:", { mintAddress, userWallet, amount, isBuy, hasSignature: !!clientSignature, launchpadId });

    if (!mintAddress || !userWallet || amount === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mintAddress, userWallet, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if trade is from an API launchpad and get fee split info
    let apiAccountId: string | null = null;
    let apiUserFeeWallet: string | null = null;
    
    if (launchpadId) {
      const { data: launchpad } = await supabase
        .from("api_launchpads")
        .select("id, api_account_id, api_accounts(id, fee_wallet_address)")
        .eq("id", launchpadId)
        .single();
      
      if (launchpad) {
        apiAccountId = launchpad.api_account_id;
        apiUserFeeWallet = (launchpad.api_accounts as any)?.fee_wallet_address;
        console.log("[launchpad-swap] API launchpad trade:", { apiAccountId, apiUserFeeWallet });
      }
    }

    // Get token
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("*")
      .eq("mint_address", mintAddress)
      .single();

    if (tokenError || !token) {
      console.error("[launchpad-swap] Token not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Token not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (token.status === "graduated") {
      return new Response(
        JSON.stringify({ 
          error: "Token has graduated. Trade on DEX.",
          jupiterUrl: `https://jup.ag/swap/SOL-${mintAddress}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate using bonding curve
    const virtualSol = token.virtual_sol_reserves || 30;
    const virtualToken = token.virtual_token_reserves || 1_000_000_000;
    const realSol = token.real_sol_reserves || 0;
    const k = virtualSol * virtualToken;

    let tokensOut = 0;
    let solOut = 0;
    let newPrice = token.price_sol || 0.00000003;
    let newVirtualSol = virtualSol;
    let newVirtualToken = virtualToken;
    let newRealSol = realSol;
    let systemFee = 0;
    let creatorFee = 0;
    let apiUserFee = 0;
    let platformFee = 0;
    let solAmount = 0;
    let tokenAmount = 0;

    if (isBuy) {
      // Buy: SOL -> Token
      const grossSolIn = amount;
      const totalFee = (grossSolIn * FEE_BPS) / 10000;
      
      // Split fee based on whether this is an API launchpad trade
      if (apiAccountId) {
        apiUserFee = totalFee * API_USER_FEE_SHARE; // 1.5%
        platformFee = totalFee * PLATFORM_FEE_SHARE; // 0.5%
        systemFee = platformFee;
      } else {
        systemFee = totalFee; // 100% to platform
        platformFee = totalFee;
      }
      
      creatorFee = 0;
      const solIn = grossSolIn - totalFee;

      newVirtualSol = virtualSol + solIn;
      newVirtualToken = k / newVirtualSol;
      tokensOut = virtualToken - newVirtualToken;
      newRealSol = realSol + solIn;
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = grossSolIn;
      tokenAmount = tokensOut;

      console.log("[launchpad-swap] Buy calculated:", { solIn, tokensOut, newPrice, systemFee, apiUserFee, platformFee });

    } else {
      // Sell: Token -> SOL
      const tokensIn = amount;
      newVirtualToken = virtualToken + tokensIn;
      newVirtualSol = k / newVirtualToken;
      const grossSolOut = virtualSol - newVirtualSol;
      
      const totalFee = (grossSolOut * FEE_BPS) / 10000;
      
      // Split fee based on whether this is an API launchpad trade
      if (apiAccountId) {
        apiUserFee = totalFee * API_USER_FEE_SHARE; // 1.5%
        platformFee = totalFee * PLATFORM_FEE_SHARE; // 0.5%
        systemFee = platformFee;
      } else {
        systemFee = totalFee; // 100% to platform
        platformFee = totalFee;
      }
      
      creatorFee = 0;
      solOut = grossSolOut - totalFee;
      
      newRealSol = Math.max(0, realSol - grossSolOut);
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = solOut;
      tokenAmount = tokensIn;

      console.log("[launchpad-swap] Sell calculated:", { tokensIn, solOut, newPrice, apiUserFee, platformFee });
    }

    // Calculate bonding curve progress and check graduation
    const graduationThreshold = token.graduation_threshold_sol || 85;
    const bondingProgress = Math.min(100, (newRealSol / graduationThreshold) * 100);
    const shouldGraduate = newRealSol >= graduationThreshold;
    const newStatus = shouldGraduate ? "graduated" : "bonding";
    const marketCap = newPrice * (token.total_supply || 1_000_000_000);

    // Calculate 24h volume from transactions
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTxs } = await supabase
      .from('launchpad_transactions')
      .select('sol_amount')
      .eq('token_id', token.id)
      .gte('created_at', twentyFourHoursAgo);
    
    const volume24h = (recentTxs || []).reduce((sum, tx) => sum + Number(tx.sol_amount), 0) + solAmount;

    // Update token
    const { error: updateError } = await supabase
      .from("tokens")
      .update({
        virtual_sol_reserves: newVirtualSol,
        virtual_token_reserves: newVirtualToken,
        real_sol_reserves: newRealSol,
        price_sol: newPrice,
        bonding_curve_progress: bondingProgress,
        market_cap_sol: marketCap,
        volume_24h_sol: volume24h,
        status: newStatus,
        graduated_at: shouldGraduate && !token.graduated_at ? new Date().toISOString() : token.graduated_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", token.id);

    if (updateError) {
      console.error("[launchpad-swap] Token update error:", updateError);
      throw updateError;
    }

    // Record price history for charts
    await supabase.from('token_price_history').insert({
      token_id: token.id,
      price_sol: newPrice,
      market_cap_sol: marketCap,
      volume_sol: solAmount,
      interval_type: '1m',
      timestamp: new Date().toISOString(),
    });

    // Use client-provided signature or generate a tracking ID
    const signature = clientSignature || `pending_${token.id}_${Date.now()}`;

    // Record transaction
    const { error: txError } = await supabase.from("launchpad_transactions").insert({
      token_id: token.id,
      user_wallet: userWallet,
      user_profile_id: profileId || null,
      transaction_type: isBuy ? "buy" : "sell",
      sol_amount: solAmount,
      token_amount: tokenAmount,
      price_per_token: newPrice,
      system_fee_sol: systemFee,
      creator_fee_sol: creatorFee,
      signature,
    });

    if (txError) {
      console.error("[launchpad-swap] Transaction insert error:", txError);
    }

    // Record API fee distribution if this is an API launchpad trade
    if (apiAccountId && apiUserFee > 0) {
      const { error: feeDistError } = await supabase.from("api_fee_distributions").insert({
        api_account_id: apiAccountId,
        launchpad_id: launchpadId,
        token_id: token.id,
        total_fee_sol: apiUserFee + platformFee,
        api_user_share: apiUserFee,
        platform_share: platformFee,
        status: "pending",
      });

      if (feeDistError) {
        console.error("[launchpad-swap] API fee distribution insert error:", feeDistError);
      } else {
        // Update API account total fees earned directly
        const { data: currentAcc } = await supabase
          .from("api_accounts")
          .select("total_fees_earned")
          .eq("id", apiAccountId)
          .single();

        if (currentAcc) {
          await supabase
            .from("api_accounts")
            .update({
              total_fees_earned: (currentAcc.total_fees_earned || 0) + apiUserFee,
              updated_at: new Date().toISOString(),
            })
            .eq("id", apiAccountId);
        }

        // Update launchpad volume and fees
        const { data: currentLp } = await supabase
          .from("api_launchpads")
          .select("total_volume_sol, total_fees_sol")
          .eq("id", launchpadId)
          .single();

        if (currentLp) {
          await supabase
            .from("api_launchpads")
            .update({
              total_volume_sol: (currentLp.total_volume_sol || 0) + solAmount,
              total_fees_sol: (currentLp.total_fees_sol || 0) + apiUserFee,
              updated_at: new Date().toISOString(),
            })
            .eq("id", launchpadId);
        }
      }
    }

    // Update/create token holding
    if (isBuy) {
      const { data: existingHolding } = await supabase
        .from("token_holdings")
        .select("*")
        .eq("token_id", token.id)
        .eq("wallet_address", userWallet)
        .single();

      if (existingHolding) {
        await supabase
          .from("token_holdings")
          .update({
            balance: existingHolding.balance + tokensOut,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingHolding.id);
      } else {
        await supabase.from("token_holdings").insert({
          token_id: token.id,
          wallet_address: userWallet,
          profile_id: profileId || null,
          balance: tokensOut,
        });
      }
    } else {
      const { data: existingHolding } = await supabase
        .from("token_holdings")
        .select("*")
        .eq("token_id", token.id)
        .eq("wallet_address", userWallet)
        .single();

      if (existingHolding) {
        const newBalance = Math.max(0, existingHolding.balance - amount);
        await supabase
          .from("token_holdings")
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingHolding.id);
      }
    }

    // Update fee tracking (system fees go to treasury)
    if (systemFee > 0) {
      const { data: systemEarner } = await supabase
        .from("fee_earners")
        .select("*")
        .eq("token_id", token.id)
        .eq("earner_type", "system")
        .single();

      if (systemEarner) {
        await supabase
          .from("fee_earners")
          .update({
            unclaimed_sol: (systemEarner.unclaimed_sol || 0) + systemFee,
            total_earned_sol: (systemEarner.total_earned_sol || 0) + systemFee,
          })
          .eq("id", systemEarner.id);
      }
    }

    // Update holder count
    const { count: holderCount } = await supabase
      .from("token_holdings")
      .select("*", { count: "exact", head: true })
      .eq("token_id", token.id)
      .gt("balance", 0);

    await supabase
      .from("tokens")
      .update({ holder_count: holderCount || 0 })
      .eq("id", token.id);

    console.log("[launchpad-swap] Success:", { signature, tokensOut, solOut, newPrice, apiUserFee, platformFee });

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        tokensOut: isBuy ? tokensOut : 0,
        solOut: isBuy ? 0 : solOut,
        newPrice,
        bondingProgress,
        graduated: shouldGraduate,
        jupiterUrl: shouldGraduate ? `https://jup.ag/swap/SOL-${mintAddress}` : undefined,
        feeSplit: apiAccountId ? { apiUserFee, platformFee } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[launchpad-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
