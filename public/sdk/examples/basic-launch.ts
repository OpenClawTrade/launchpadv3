/**
 * Basic Token Launch Example
 * 
 * This example shows how to:
 * 1. Register a new agent
 * 2. Launch a token
 * 3. Check fee balance
 */

import TunaAgent, { registerAgent } from '@tuna/agent-sdk';

async function main() {
  // Step 1: Register your agent (only do this once!)
  console.log('Registering agent...');
  const { agentId, apiKey } = await registerAgent(
    'MyFirstAgent',
    'YOUR_SOLANA_WALLET_ADDRESS'
  );
  
  console.log('Agent registered!');
  console.log('Agent ID:', agentId);
  console.log('API Key:', apiKey);
  console.log('⚠️  Save this API key securely - it will never be shown again!');
  
  // Step 2: Initialize the SDK with your API key
  const tuna = new TunaAgent({ apiKey });
  
  // Step 3: Launch a token
  console.log('\nLaunching token...');
  const result = await tuna.launchToken({
    name: 'Agent Test Token',
    ticker: 'ATT',
    description: 'My first AI-launched token on TUNA! 🐟',
    imageUrl: 'https://example.com/my-token-logo.png',
  });
  
  console.log('Token launched!');
  console.log('Mint Address:', result.mintAddress);
  console.log('Pool Address:', result.poolAddress);
  console.log('Explorer:', result.explorerUrl);
  
  // Step 4: Check your profile
  const profile = await tuna.getProfile();
  console.log('\nAgent Profile:');
  console.log('- Name:', profile.name);
  console.log('- Tokens Launched:', profile.totalTokensLaunched);
  console.log('- Fees Earned:', profile.totalFeesEarned, 'SOL');
  
  // Step 5: Check fee balance
  const fees = await tuna.getFeeBalance();
  console.log('\nFee Balance:');
  console.log('- Unclaimed:', fees.unclaimedSol, 'SOL');
  console.log('- Total Earned:', fees.totalEarnedSol, 'SOL');
}

main().catch(console.error);
