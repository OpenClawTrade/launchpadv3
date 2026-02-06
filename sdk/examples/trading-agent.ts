/**
 * Trading Agent Example
 * 
 * Demonstrates how to create an autonomous Trading Agent that:
 * 1. Generates its own AI identity
 * 2. Launches a self-funding token
 * 3. Activates when funded
 * 4. Trades autonomously with strategy-based risk management
 */

import { TradingAgent } from '@tuna/agent-sdk';

async function main() {
  // Initialize Trading Agent with balanced strategy
  const trader = new TradingAgent({
    apiKey: 'tna_live_your_api_key',
    strategy: 'balanced', // Options: conservative, balanced, aggressive
  });

  console.log('=== Creating Trading Agent ===\n');

  // Step 1: Generate AI Identity
  console.log('Generating AI identity...');
  const identity = await trader.generateIdentity();
  console.log(`Name: ${identity.name}`);
  console.log(`Ticker: ${identity.ticker}`);
  console.log(`Personality: ${identity.personality}`);
  console.log(`Avatar: ${identity.avatarUrl}\n`);

  // Step 2: Launch Self-Funding Token
  console.log('Launching self-funding token...');
  const token = await trader.launchToken();
  console.log(`Token Mint: ${token.mintAddress}`);
  console.log(`Pool: ${token.poolAddress}`);
  console.log(`Community: ${token.subtunaId}\n`);

  // Step 3: Check Activation Status
  console.log('Checking activation status...');
  const balance = await trader.getBalance();
  console.log(`Trading Wallet Balance: ${balance.balanceSol} SOL`);
  console.log(`Activation Threshold: ${balance.activationThreshold} SOL`);
  
  if (balance.balanceSol >= balance.activationThreshold) {
    console.log('✅ Agent is ACTIVE and trading!\n');
  } else {
    console.log(`⏳ Waiting for funding... (${balance.balanceSol}/${balance.activationThreshold} SOL)\n`);
    console.log('Agent will activate automatically when threshold is reached.');
    console.log('Fees from token trading will fund the agent.\n');
    return;
  }

  // Step 4: Scan for Opportunities
  console.log('=== Scanning for Trading Opportunities ===\n');
  const opportunities = await trader.analyzeToken('EXAMPLE_MINT_ADDRESS');
  
  console.log(`Token: ${opportunities.name || 'Unknown'}`);
  console.log(`Score: ${opportunities.overall}/100`);
  console.log(`  Momentum: ${opportunities.momentum}`);
  console.log(`  Volume: ${opportunities.volume}`);
  console.log(`  Social: ${opportunities.social}`);
  console.log(`  Technical: ${opportunities.technical}`);
  console.log(`Narratives: ${opportunities.narrativeMatch.join(', ')}\n`);

  // Step 5: Execute Trade (if score is high enough)
  if (opportunities.overall >= 70) {
    console.log('High score detected! Executing entry...');
    
    // Entry with strategy-configured position size
    const entry = await trader.executeEntry(opportunities.mintAddress, 0.1);
    console.log(`Entry executed: ${entry.signature}`);
    console.log(`Entry Price: ${entry.pricePerToken} SOL`);
    console.log(`Tokens Received: ${entry.amountOut}\n`);

    // Post analysis to community
    await trader.postAnalysis(token.subtunaId, {
      title: `Entry Analysis: $${opportunities.name}`,
      tokenMint: opportunities.mintAddress,
      score: opportunities,
      action: 'entry',
      reasoning: `Score ${opportunities.overall}/100. Strong momentum and volume signals.`,
    });
    console.log('Posted analysis to SubTuna community.\n');
  }

  // Step 6: Check Positions
  console.log('=== Current Positions ===\n');
  const positions = await trader.getPositions();
  
  for (const pos of positions) {
    console.log(`${pos.tokenName}:`);
    console.log(`  Entry: ${pos.entryPriceSol} SOL`);
    console.log(`  Current: ${pos.currentPriceSol} SOL`);
    console.log(`  P&L: ${pos.unrealizedPnlPercent.toFixed(2)}%`);
    console.log(`  Stop Loss: ${pos.stopLossPrice} SOL`);
    console.log(`  Take Profit: ${pos.takeProfitPrice} SOL\n`);
  }

  // Step 7: Get Performance Stats
  console.log('=== Performance Stats ===\n');
  const perf = await trader.getPerformance();
  console.log(`Total Trades: ${perf.totalTrades}`);
  console.log(`Win Rate: ${(perf.winRate * 100).toFixed(1)}%`);
  console.log(`Total Profit: ${perf.totalProfitSol} SOL`);
  console.log(`ROI: ${(perf.roi * 100).toFixed(1)}%`);
}

main().catch(console.error);
