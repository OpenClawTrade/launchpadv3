import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vanity-secret',
};

function applyCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

// Configuration
const DEFAULT_SUFFIX = '67x';
const MAX_DURATION_MS = 55000;
const BATCH_SIZE = 3000;
const PROGRESS_INTERVAL = 2000; // Send progress every 2 seconds

// XOR encryption for secret key storage
function encryptSecretKey(secretKeyHex: string, encryptionKey: string): string {
  const keyBytes = Buffer.from(encryptionKey, 'utf-8');
  const dataBytes = Buffer.from(secretKeyHex, 'hex');
  
  const encrypted = Buffer.alloc(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return encrypted.toString('hex');
}

function matchesSuffix(address: string, suffix: string): boolean {
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Streaming batch endpoint - sends real-time progress updates via SSE
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = '123456';
  
  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { suffix = DEFAULT_SUFFIX, targetCount = 100 } = req.body || {};

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, data: object) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const supabase = getSupabaseClient();
    const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';

    // Get initial stats
    const { data: statsData } = await supabase.rpc('backend_get_vanity_stats', {
      p_suffix: suffix.toLowerCase(),
    });
    const statsBefore = statsData?.[0] || { available: 0 };
    const availableBefore = Number(statsBefore.available) || 0;

    if (availableBefore >= targetCount) {
      sendEvent('complete', { 
        found: 0, 
        attempts: 0, 
        duration: 0, 
        rate: 0,
        addresses: [],
        poolSize: availableBefore 
      });
      return res.end();
    }

    sendEvent('start', { 
      suffix, 
      targetCount, 
      poolSize: availableBefore,
      maxDuration: MAX_DURATION_MS 
    });

    const startTime = Date.now();
    let attempts = 0;
    let lastProgressTime = startTime;
    const foundKeypairs: string[] = [];

    // Generation loop with streaming progress
    while (Date.now() - startTime < MAX_DURATION_MS) {
      // Process batch
      for (let i = 0; i < BATCH_SIZE; i++) {
        attempts++;
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toBase58();
        
        if (matchesSuffix(address, suffix)) {
          foundKeypairs.push(address);
          
          // Save to database
          const secretKeyHex = Buffer.from(keypair.secretKey).toString('hex');
          const encryptedSecretKey = encryptSecretKey(secretKeyHex, encryptionKey);
          
          try {
            await supabase.rpc('backend_insert_vanity_keypair', {
              p_suffix: suffix.toLowerCase(),
              p_public_key: address,
              p_secret_key_encrypted: encryptedSecretKey,
            });
          } catch (e) {
            console.error('Save error:', e);
          }
          
          // Send found event immediately
          const elapsed = Date.now() - startTime;
          sendEvent('found', { 
            address, 
            totalFound: foundKeypairs.length, 
            attempts,
            elapsed,
            rate: Math.round(attempts / (elapsed / 1000)),
          });
        }
      }
      
      // Send progress update every PROGRESS_INTERVAL
      const now = Date.now();
      if (now - lastProgressTime >= PROGRESS_INTERVAL) {
        const elapsed = now - startTime;
        const rate = Math.round(attempts / (elapsed / 1000));
        const remaining = MAX_DURATION_MS - elapsed;
        
        sendEvent('progress', {
          attempts,
          found: foundKeypairs.length,
          elapsed,
          rate,
          remaining,
          percentComplete: Math.round((elapsed / MAX_DURATION_MS) * 100),
        });
        
        lastProgressTime = now;
      }
    }

    // Get final stats
    const { data: finalStatsData } = await supabase.rpc('backend_get_vanity_stats', {
      p_suffix: suffix.toLowerCase(),
    });
    const statsAfter = finalStatsData?.[0] || { total: 0, available: 0, reserved: 0, used: 0 };
    
    // Get suffix breakdown
    const { data: suffixData } = await supabase.rpc('backend_get_vanity_suffixes');

    const duration = Date.now() - startTime;
    const rate = Math.round(attempts / (duration / 1000));

    sendEvent('complete', {
      found: foundKeypairs.length,
      attempts,
      duration,
      rate,
      addresses: foundKeypairs,
      poolSize: Number(statsAfter.available) || 0,
      stats: {
        total: Number(statsAfter.total) || 0,
        available: Number(statsAfter.available) || 0,
        reserved: Number(statsAfter.reserved) || 0,
        used: Number(statsAfter.used) || 0,
        suffixes: (suffixData || []).map((s: { suffix: string; count: number }) => ({
          suffix: s.suffix,
          count: Number(s.count),
        })),
      },
    });

    res.end();

  } catch (error) {
    console.error('[vanity/batch-stream] Error:', error);
    sendEvent('error', { 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.end();
  }
}
