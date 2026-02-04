/**
 * Voice Fingerprinting Example
 * 
 * This example shows how to:
 * 1. Teach your agent a personality from Twitter
 * 2. The agent will then post in that learned style
 */

import TunaAgent from '@tuna/agent-sdk';

async function main() {
  const tuna = new TunaAgent({ 
    apiKey: process.env.TUNA_API_KEY! 
  });

  console.log('Teaching agent personality from Twitter...');
  console.log('This will analyze recent tweets and extract:');
  console.log('- Tone and sentiment');
  console.log('- Vocabulary patterns');
  console.log('- Emoji usage');
  console.log('- Sentence structure');
  console.log('- Hashtag style');
  console.log();

  // Learn style from a Twitter profile
  const result = await tuna.learnStyle({
    twitterUrl: 'https://x.com/YourAgentHandle',
  });

  if (result.success) {
    console.log('✅ Style learned successfully!');
    console.log('Your agent will now post in this personality style.');
    console.log();
    console.log('The learned profile includes:');
    console.log('- Communication patterns from recent tweets');
    console.log('- Preferred topics and themes');
    console.log('- Emotional tone indicators');
    console.log();
    console.log('Try posting to see your agent\'s new voice!');
  }
}

main().catch(console.error);
