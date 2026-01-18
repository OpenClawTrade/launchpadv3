import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';

// Base58 alphabet for Solana addresses
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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

// Decrypt secret key for token launch
export function decryptSecretKey(encryptedHex: string, encryptionKey: string): Uint8Array {
  const keyBytes = Buffer.from(encryptionKey, 'utf-8');
  const encryptedBytes = Buffer.from(encryptedHex, 'hex');
  
  const decrypted = Buffer.alloc(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new Uint8Array(decrypted);
}

// Check if address ends with target suffix (case-insensitive)
function matchesSuffix(address: string, suffix: string): boolean {
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}

// Generate a single keypair and check suffix
function generateAndCheck(suffix: string): { keypair: Keypair; address: string } | null {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  
  if (matchesSuffix(address, suffix)) {
    return { keypair, address };
  }
  return null;
}

export interface VanityGenerationResult {
  found: number;
  attempts: number;
  duration: number;
  addresses: string[];
}

export interface SavedKeypair {
  id: string;
  suffix: string;
  publicKey: string;
  status: string;
  createdAt: string;
}

// Main generation function - runs for up to maxDuration seconds
export async function generateVanityAddresses(
  suffix: string,
  maxDuration: number = 55000, // 55 seconds (leave 5s buffer for Vercel 60s limit)
  batchSize: number = 1000
): Promise<VanityGenerationResult> {
  const startTime = Date.now();
  let attempts = 0;
  const foundKeypairs: { keypair: Keypair; address: string }[] = [];
  
  console.log(`[vanity] Starting generation for suffix "${suffix}" (max ${maxDuration}ms)`);
  
  // Get Supabase client for saving
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Generation loop
  while (Date.now() - startTime < maxDuration) {
    // Process batch
    for (let i = 0; i < batchSize; i++) {
      attempts++;
      const result = generateAndCheck(suffix);
      
      if (result) {
        foundKeypairs.push(result);
        console.log(`[vanity] ✅ Found match #${foundKeypairs.length}: ${result.address} (${attempts} attempts)`);
        
        // Save immediately to database
        const secretKeyHex = Buffer.from(result.keypair.secretKey).toString('hex');
        const encryptedSecretKey = encryptSecretKey(secretKeyHex, encryptionKey);
        
        try {
          const { error } = await supabase
            .from('vanity_keypairs')
            .insert({
              suffix: suffix.toLowerCase(),
              public_key: result.address,
              secret_key_encrypted: encryptedSecretKey,
              status: 'available',
            });
          
          if (error) {
            if (error.code === '23505') {
              console.log(`[vanity] Address already exists, skipping: ${result.address}`);
            } else {
              console.error(`[vanity] Failed to save keypair:`, error);
            }
          } else {
            console.log(`[vanity] 💾 Saved to database: ${result.address}`);
          }
        } catch (saveError) {
          console.error(`[vanity] Save error:`, saveError);
        }
      }
    }
    
    // Log progress every 100k attempts
    if (attempts % 100000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(attempts / elapsed);
      console.log(`[vanity] Progress: ${attempts.toLocaleString()} attempts, ${rate.toLocaleString()}/sec, ${foundKeypairs.length} found`);
    }
  }
  
  const duration = Date.now() - startTime;
  const rate = Math.round(attempts / (duration / 1000));
  
  console.log(`[vanity] Generation complete: ${attempts.toLocaleString()} attempts in ${duration}ms (${rate.toLocaleString()}/sec), ${foundKeypairs.length} addresses found`);
  
  return {
    found: foundKeypairs.length,
    attempts,
    duration,
    addresses: foundKeypairs.map(kp => kp.address),
  };
}

// Get next available vanity address for token launch
export async function getAvailableVanityAddress(suffix: string): Promise<{
  id: string;
  publicKey: string;
  keypair: Keypair;
} | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get first available keypair with matching suffix
  const { data, error } = await supabase
    .from('vanity_keypairs')
    .select('id, public_key, secret_key_encrypted')
    .eq('suffix', suffix.toLowerCase())
    .eq('status', 'available')
    .limit(1)
    .single();
  
  if (error || !data) {
    console.log(`[vanity] No available vanity address for suffix "${suffix}"`);
    return null;
  }
  
  // Reserve it immediately
  const { error: updateError } = await supabase
    .from('vanity_keypairs')
    .update({ status: 'reserved' })
    .eq('id', data.id);
  
  if (updateError) {
    console.error(`[vanity] Failed to reserve keypair:`, updateError);
    return null;
  }
  
  // Decrypt the secret key
  const secretKeyBytes = decryptSecretKey(data.secret_key_encrypted, encryptionKey);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);
  
  console.log(`[vanity] Reserved vanity address: ${data.public_key}`);
  
  return {
    id: data.id,
    publicKey: data.public_key,
    keypair,
  };
}

// Mark vanity address as used for a token
export async function markVanityAddressUsed(keypairId: string, tokenId: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  await supabase
    .from('vanity_keypairs')
    .update({ 
      status: 'used',
      used_for_token_id: tokenId,
    })
    .eq('id', keypairId);
  
  console.log(`[vanity] Marked keypair ${keypairId} as used for token ${tokenId}`);
}

// Release a reserved address back to available
export async function releaseVanityAddress(keypairId: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  await supabase
    .from('vanity_keypairs')
    .update({ status: 'available' })
    .eq('id', keypairId)
    .eq('status', 'reserved');
  
  console.log(`[vanity] Released keypair ${keypairId} back to available`);
}

// Get statistics about vanity keypairs
export async function getVanityStats(suffix?: string): Promise<{
  total: number;
  available: number;
  reserved: number;
  used: number;
  suffixes: { suffix: string; count: number }[];
}> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  let query = supabase.from('vanity_keypairs').select('suffix, status');
  
  if (suffix) {
    query = query.eq('suffix', suffix.toLowerCase());
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to get vanity stats: ${error.message}`);
  }
  
  const stats = {
    total: data?.length || 0,
    available: data?.filter(d => d.status === 'available').length || 0,
    reserved: data?.filter(d => d.status === 'reserved').length || 0,
    used: data?.filter(d => d.status === 'used').length || 0,
    suffixes: [] as { suffix: string; count: number }[],
  };
  
  // Group by suffix
  const suffixCounts = new Map<string, number>();
  data?.forEach(d => {
    suffixCounts.set(d.suffix, (suffixCounts.get(d.suffix) || 0) + 1);
  });
  
  stats.suffixes = Array.from(suffixCounts.entries())
    .map(([suffix, count]) => ({ suffix, count }))
    .sort((a, b) => b.count - a.count);
  
  return stats;
}
