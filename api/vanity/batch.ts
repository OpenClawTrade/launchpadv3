import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateVanityAddresses, getVanityStats } from '../../lib/vanityGenerator.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Configuration for batch generation
const DEFAULT_SUFFIX = '67x';
const MAX_DURATION_MS = 55000;
const BATCH_SIZE = 3000; // Higher batch size for maximum throughput

/**
 * Batch endpoint for intensive vanity generation
 * Designed to be called repeatedly by a cron job or external scheduler
 * to build up a large pool of vanity addresses
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = process.env.TREASURY_PRIVATE_KEY?.slice(0, 16);
  
  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      suffix = DEFAULT_SUFFIX,
      targetCount = 100, // Keep running until we have this many available
    } = req.body || {};
    
    console.log(`[vanity/batch] Starting batch generation for suffix "${suffix}"`);
    console.log(`[vanity/batch] Target: ${targetCount} available addresses`);
    
    // Check current count
    const statsBefore = await getVanityStats(suffix);
    
    if (statsBefore.available >= targetCount) {
      console.log(`[vanity/batch] Already have ${statsBefore.available} available, target met!`);
      return res.status(200).json({
        success: true,
        message: 'Target already met',
        suffix,
        stats: statsBefore,
        generated: 0,
      });
    }
    
    const needed = targetCount - statsBefore.available;
    console.log(`[vanity/batch] Need ${needed} more addresses to reach target`);
    
    // Run generation at maximum speed
    const result = await generateVanityAddresses(suffix, MAX_DURATION_MS, BATCH_SIZE);
    
    // Get updated stats
    const statsAfter = await getVanityStats(suffix);
    
    const response = {
      success: true,
      suffix,
      batch: {
        found: result.found,
        attempts: result.attempts,
        duration: result.duration,
        rate: Math.round(result.attempts / (result.duration / 1000)),
      },
      progress: {
        before: statsBefore.available,
        after: statsAfter.available,
        target: targetCount,
        remaining: Math.max(0, targetCount - statsAfter.available),
        percentComplete: Math.min(100, Math.round((statsAfter.available / targetCount) * 100)),
      },
      stats: statsAfter,
      // Include addresses for logging
      newAddresses: result.addresses,
    };
    
    console.log(`[vanity/batch] Complete! Progress: ${response.progress.percentComplete}%`);
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('[vanity/batch] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
