import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  signature: string;
  timestamp: number;
  type: 'buy' | 'sell' | 'transfer';
  wallet: string;
  solAmount: number;
  tokenAmount: number;
  slot: number;
}

interface WalletAnalysis {
  wallet: string;
  totalBought: number;
  totalSold: number;
  totalBoughtSol: number;
  totalSoldSol: number;
  firstBuyTime: number;
  lastSellTime: number | null;
  txCount: number;
  isBot: boolean;
  botReason: string[];
  transactions: Transaction[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress, limit = 50000 } = await req.json();
    
    if (!mintAddress) {
      return new Response(JSON.stringify({ error: 'Missing mintAddress' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY');
    if (!HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    console.log(`[investigate] Starting analysis for ${mintAddress}, limit: ${limit}`);

    // Fetch all transactions for the token using Helius parsed transaction history
    const allTransactions: Transaction[] = [];
    let lastSignature: string | undefined;
    const batchSize = 1000;
    let fetchCount = 0;

    while (allTransactions.length < limit) {
      const url = `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${batchSize}${lastSignature ? `&before=${lastSignature}` : ''}`;
      
      console.log(`[investigate] Fetching batch ${fetchCount + 1}, current total: ${allTransactions.length}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[investigate] Helius API error: ${errorText}`);
        break;
      }

      const transactions = await response.json();
      
      if (!transactions || transactions.length === 0) {
        console.log('[investigate] No more transactions found');
        break;
      }

      // Parse each transaction
      for (const tx of transactions) {
        const parsed = parseTransaction(tx, mintAddress);
        if (parsed) {
          allTransactions.push(parsed);
        }
      }

      lastSignature = transactions[transactions.length - 1]?.signature;
      fetchCount++;

      // Safety limit
      if (fetchCount > 100) {
        console.log('[investigate] Reached max fetch iterations');
        break;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[investigate] Fetched ${allTransactions.length} transactions`);

    // Analyze wallets
    const walletMap = new Map<string, WalletAnalysis>();

    for (const tx of allTransactions) {
      if (!walletMap.has(tx.wallet)) {
        walletMap.set(tx.wallet, {
          wallet: tx.wallet,
          totalBought: 0,
          totalSold: 0,
          totalBoughtSol: 0,
          totalSoldSol: 0,
          firstBuyTime: tx.timestamp,
          lastSellTime: null,
          txCount: 0,
          isBot: false,
          botReason: [],
          transactions: [],
        });
      }

      const analysis = walletMap.get(tx.wallet)!;
      analysis.txCount++;
      analysis.transactions.push(tx);

      if (tx.type === 'buy') {
        analysis.totalBought += tx.tokenAmount;
        analysis.totalBoughtSol += tx.solAmount;
        if (tx.timestamp < analysis.firstBuyTime) {
          analysis.firstBuyTime = tx.timestamp;
        }
      } else if (tx.type === 'sell') {
        analysis.totalSold += tx.tokenAmount;
        analysis.totalSoldSol += tx.solAmount;
        if (!analysis.lastSellTime || tx.timestamp > analysis.lastSellTime) {
          analysis.lastSellTime = tx.timestamp;
        }
      }
    }

    // Detect bots and analyze patterns
    const walletAnalyses = Array.from(walletMap.values());
    
    for (const analysis of walletAnalyses) {
      // Bot detection heuristics
      const botReasons: string[] = [];

      // 1. High frequency trading (more than 20 txs in short period)
      if (analysis.txCount > 20) {
        const timeSpan = Math.max(...analysis.transactions.map(t => t.timestamp)) - 
                         Math.min(...analysis.transactions.map(t => t.timestamp));
        if (timeSpan < 3600) { // Less than 1 hour
          botReasons.push('High frequency trading');
        }
      }

      // 2. Buy and sell within same block or very close blocks
      const buyTxs = analysis.transactions.filter(t => t.type === 'buy');
      const sellTxs = analysis.transactions.filter(t => t.type === 'sell');
      
      for (const buy of buyTxs) {
        for (const sell of sellTxs) {
          if (Math.abs(buy.slot - sell.slot) < 5) {
            botReasons.push('Same-block buy/sell');
            break;
          }
        }
      }

      // 3. Consistent small amounts (wash trading)
      if (analysis.txCount > 5) {
        const amounts = analysis.transactions.map(t => t.solAmount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
        if (variance < 0.01 && avgAmount < 0.5) {
          botReasons.push('Consistent small amounts (wash trading)');
        }
      }

      // 4. Round trip trades (buy then sell similar amounts)
      if (analysis.totalBought > 0 && analysis.totalSold > 0) {
        const ratio = analysis.totalSold / analysis.totalBought;
        if (ratio > 0.95 && ratio < 1.05 && analysis.txCount > 4) {
          botReasons.push('Round-trip trading pattern');
        }
      }

      analysis.isBot = botReasons.length > 0;
      analysis.botReason = [...new Set(botReasons)];
    }

    // Sort by first buy time to get early buyers
    const sortedByFirstBuy = [...walletAnalyses].sort((a, b) => a.firstBuyTime - b.firstBuyTime);
    
    // Get top 100 by volume
    const top100ByVolume = [...walletAnalyses]
      .sort((a, b) => (b.totalBoughtSol + b.totalSoldSol) - (a.totalBoughtSol + a.totalSoldSol))
      .slice(0, 100);

    // Get first 50 buyers
    const first50Buyers = sortedByFirstBuy
      .filter(w => w.totalBought > 0)
      .slice(0, 50);

    // Bot statistics
    const botWallets = walletAnalyses.filter(w => w.isBot);
    const botVolume = botWallets.reduce((sum, w) => sum + w.totalBoughtSol + w.totalSoldSol, 0);
    const totalVolume = walletAnalyses.reduce((sum, w) => sum + w.totalBoughtSol + w.totalSoldSol, 0);

    const result = {
      mintAddress,
      totalTransactions: allTransactions.length,
      uniqueWallets: walletAnalyses.length,
      stats: {
        totalVolumeSol: totalVolume,
        botWalletCount: botWallets.length,
        botVolumePercentage: totalVolume > 0 ? (botVolume / totalVolume) * 100 : 0,
        botVolumeSol: botVolume,
      },
      first50Buyers: first50Buyers.map(w => ({
        wallet: w.wallet,
        firstBuyTime: new Date(w.firstBuyTime * 1000).toISOString(),
        totalBoughtSol: w.totalBoughtSol,
        totalBought: w.totalBought,
        totalSold: w.totalSold,
        soldAll: w.totalSold >= w.totalBought * 0.95,
        lastSellTime: w.lastSellTime ? new Date(w.lastSellTime * 1000).toISOString() : null,
        isBot: w.isBot,
        botReason: w.botReason,
        txCount: w.txCount,
        firstTxSignature: w.transactions[0]?.signature,
      })),
      top100ByVolume: top100ByVolume.map(w => ({
        wallet: w.wallet,
        totalVolumeSol: w.totalBoughtSol + w.totalSoldSol,
        totalBoughtSol: w.totalBoughtSol,
        totalSoldSol: w.totalSoldSol,
        totalBought: w.totalBought,
        totalSold: w.totalSold,
        firstBuyTime: new Date(w.firstBuyTime * 1000).toISOString(),
        lastSellTime: w.lastSellTime ? new Date(w.lastSellTime * 1000).toISOString() : null,
        isBot: w.isBot,
        botReason: w.botReason,
        txCount: w.txCount,
        holdingPercent: w.totalBought > 0 ? ((w.totalBought - w.totalSold) / w.totalBought) * 100 : 0,
      })),
      botWallets: botWallets.slice(0, 100).map(w => ({
        wallet: w.wallet,
        reason: w.botReason,
        volumeSol: w.totalBoughtSol + w.totalSoldSol,
        txCount: w.txCount,
      })),
    };

    console.log(`[investigate] Analysis complete. Bots: ${botWallets.length}, First buyers: ${first50Buyers.length}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[investigate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseTransaction(tx: any, mintAddress: string): Transaction | null {
  try {
    const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);
    const slot = tx.slot || 0;
    const signature = tx.signature;

    // Check token transfers
    const tokenTransfers = tx.tokenTransfers || [];
    const nativeTransfers = tx.nativeTransfers || [];

    for (const transfer of tokenTransfers) {
      if (transfer.mint?.toLowerCase() === mintAddress.toLowerCase()) {
        const tokenAmount = transfer.tokenAmount || 0;
        
        // Find corresponding SOL transfer
        let solAmount = 0;
        for (const native of nativeTransfers) {
          if (native.amount) {
            solAmount = Math.abs(native.amount) / 1e9;
            break;
          }
        }

        // Determine if buy or sell based on who received tokens
        const isBuy = transfer.toUserAccount && transfer.fromUserAccount;
        const wallet = isBuy ? transfer.toUserAccount : transfer.fromUserAccount;

        if (wallet) {
          return {
            signature,
            timestamp,
            type: isBuy ? 'buy' : 'sell',
            wallet,
            solAmount,
            tokenAmount,
            slot,
          };
        }
      }
    }

    // Also check swap events
    if (tx.events?.swap) {
      const swap = tx.events.swap;
      const wallet = tx.feePayer;
      
      // Check if this swap involves our token
      const tokenIn = swap.tokenInputs?.find((t: any) => t.mint?.toLowerCase() === mintAddress.toLowerCase());
      const tokenOut = swap.tokenOutputs?.find((t: any) => t.mint?.toLowerCase() === mintAddress.toLowerCase());

      if (tokenOut) {
        // Buying token
        return {
          signature,
          timestamp,
          type: 'buy',
          wallet,
          solAmount: (swap.nativeInput?.amount || 0) / 1e9,
          tokenAmount: tokenOut.rawTokenAmount?.tokenAmount || 0,
          slot,
        };
      } else if (tokenIn) {
        // Selling token
        return {
          signature,
          timestamp,
          type: 'sell',
          wallet,
          solAmount: (swap.nativeOutput?.amount || 0) / 1e9,
          tokenAmount: tokenIn.rawTokenAmount?.tokenAmount || 0,
          slot,
        };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}
