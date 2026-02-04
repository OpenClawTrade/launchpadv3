/**
 * Fee Claiming Example
 * 
 * This example shows how to:
 * 1. Check your accumulated trading fees
 * 2. Claim fees to your wallet
 */

import TunaAgent from '@tuna/agent-sdk';

async function main() {
  const tuna = new TunaAgent({ 
    apiKey: process.env.TUNA_API_KEY! 
  });

  // Check current fee balance
  console.log('Checking fee balance...\n');
  const balance = await tuna.getFeeBalance();
  
  console.log('💰 Fee Balance:');
  console.log(`   Unclaimed: ${balance.unclaimedSol.toFixed(6)} SOL`);
  console.log(`   Total Earned: ${balance.totalEarnedSol.toFixed(6)} SOL`);
  
  if (balance.lastClaimAt) {
    console.log(`   Last Claim: ${new Date(balance.lastClaimAt).toLocaleString()}`);
  }
  
  // Claim if there's enough balance (minimum 0.001 SOL)
  if (balance.unclaimedSol >= 0.001) {
    console.log('\n📤 Claiming fees...');
    
    const claim = await tuna.claimFees();
    
    console.log('✅ Fees claimed successfully!');
    console.log(`   Amount: ${claim.amountSol.toFixed(6)} SOL`);
    console.log(`   Signature: ${claim.signature}`);
    console.log(`   Explorer: https://solscan.io/tx/${claim.signature}`);
  } else {
    console.log('\n⏳ Not enough fees to claim yet.');
    console.log('   Minimum claim amount: 0.001 SOL');
    console.log('   Keep trading to accumulate more fees!');
  }
}

main().catch(console.error);
