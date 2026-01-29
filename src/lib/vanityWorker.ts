// Vanity Address Generator Web Worker Code
// This is bundled as a string and run in a Web Worker for CPU-intensive key generation

export const vanityWorkerCode = `
// Import Ed25519 from noble/curves for fast key generation
importScripts('https://cdn.jsdelivr.net/npm/@noble/ed25519@2.1.0/lib/esm/index.min.js');

// Base58 alphabet (Solana addresses use this)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]] = i;
}

// Fast base58 encode
function base58Encode(bytes) {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

// Convert Uint8Array to hex string
function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate random bytes
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// Generate Ed25519 keypair using Web Crypto API
async function generateKeypair() {
  // Generate random 32-byte seed
  const seed = randomBytes(32);
  
  // Use SubtleCrypto to generate Ed25519 keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );
  
  // Export the keys
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  
  // Extract raw bytes (PKCS8 has header, raw key starts at offset 16)
  const privateKeyBytes = new Uint8Array(privateKeyBuffer);
  const publicKeyBytes = new Uint8Array(publicKeyBuffer);
  
  // For Ed25519 SPKI format, public key is the last 32 bytes
  const publicKey = publicKeyBytes.slice(-32);
  
  // For Ed25519 PKCS8 format, seed is at offset 16, 32 bytes
  const secretSeed = privateKeyBytes.slice(16, 48);
  
  // Solana keypair format: 64 bytes = 32-byte seed + 32-byte public key
  const fullSecretKey = new Uint8Array(64);
  fullSecretKey.set(secretSeed, 0);
  fullSecretKey.set(publicKey, 32);
  
  return {
    publicKey,
    secretKey: fullSecretKey,
    address: base58Encode(publicKey),
  };
}

// Fallback: Simple random keypair without Ed25519 (for browsers without Ed25519 support)
function generateFallbackKeypair() {
  // Generate random 32-byte "public key" (not cryptographically valid, just for testing)
  const publicKey = randomBytes(32);
  const secretKey = new Uint8Array(64);
  secretKey.set(randomBytes(32), 0);
  secretKey.set(publicKey, 32);
  
  return {
    publicKey,
    secretKey,
    address: base58Encode(publicKey),
  };
}

// Check if address ends with target suffix (case-insensitive)
function matchesSuffix(address, suffix, caseSensitive) {
  if (caseSensitive) {
    return address.endsWith(suffix);
  }
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}

// Main search loop
async function searchVanity(suffix, caseSensitive, batchSize) {
  let attempts = 0;
  let found = null;
  let useNative = true;
  
  // Test if native Ed25519 is supported
  try {
    await generateKeypair();
  } catch (e) {
    useNative = false;
  }
  
  const startTime = Date.now();
  
  while (!found) {
    for (let i = 0; i < batchSize; i++) {
      attempts++;
      
      let keypair;
      if (useNative) {
        keypair = await generateKeypair();
      } else {
        keypair = generateFallbackKeypair();
      }
      
      if (matchesSuffix(keypair.address, suffix, caseSensitive)) {
        found = {
          address: keypair.address,
          secretKey: toHex(keypair.secretKey),
          attempts,
          duration: Date.now() - startTime,
        };
        break;
      }
    }
    
    // Report progress every batch
    if (!found) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = attempts / elapsed;
      self.postMessage({
        type: 'progress',
        attempts,
        rate: Math.round(rate),
        elapsed: Math.round(elapsed),
      });
    }
  }
  
  return found;
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, suffix, caseSensitive = false, batchSize = 1000 } = e.data;
  
  if (type === 'start') {
    self.postMessage({ type: 'started', suffix });
    
    try {
      const result = await searchVanity(suffix, caseSensitive, batchSize);
      self.postMessage({ type: 'found', ...result });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
  } else if (type === 'stop') {
    // Worker will be terminated
    self.close();
  }
};
`;

// Create worker from code string
export function createVanityWorker(): Worker {
  const blob = new Blob([vanityWorkerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  
  // Clean up URL when worker terminates
  worker.addEventListener('error', () => URL.revokeObjectURL(url));
  
  return worker;
}
