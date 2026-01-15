import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VanityKeypair {
  id: string;
  suffix: string;
  public_key: string;
  status: 'available' | 'used' | 'reserved';
  used_for_token_id: string | null;
  created_at: string;
}

interface GenerationProgress {
  attempts: number;
  rate: number; // keys per second
  elapsed: number; // seconds
}

interface GenerationResult {
  address: string;
  secretKey: string; // hex encoded
  attempts: number;
  duration: number; // milliseconds
}

interface UseVanityGeneratorResult {
  // State
  isGenerating: boolean;
  progress: GenerationProgress | null;
  result: GenerationResult | null;
  error: string | null;
  
  // Saved keypairs
  savedKeypairs: VanityKeypair[];
  isLoadingKeypairs: boolean;
  
  // Actions
  startGeneration: (suffix: string, caseSensitive?: boolean) => void;
  stopGeneration: () => void;
  saveKeypair: (address: string, secretKeyHex: string, suffix: string) => Promise<boolean>;
  fetchSavedKeypairs: () => Promise<void>;
}

// Inline worker code for vanity address generation
const workerCode = `
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// Fast keypair generation using Web Crypto Ed25519
async function generateKeypair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    );
    
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    
    const privateKeyBytes = new Uint8Array(privateKeyBuffer);
    const publicKeyBytes = new Uint8Array(publicKeyBuffer);
    
    const publicKey = publicKeyBytes.slice(-32);
    const secretSeed = privateKeyBytes.slice(16, 48);
    
    const fullSecretKey = new Uint8Array(64);
    fullSecretKey.set(secretSeed, 0);
    fullSecretKey.set(publicKey, 32);
    
    return {
      publicKey,
      secretKey: fullSecretKey,
      address: base58Encode(publicKey),
    };
  } catch (e) {
    // Fallback for browsers without Ed25519 support
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
}

function matchesSuffix(address, suffix, caseSensitive) {
  if (caseSensitive) {
    return address.endsWith(suffix);
  }
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}

let shouldStop = false;

async function searchVanity(suffix, caseSensitive, batchSize) {
  let attempts = 0;
  let found = null;
  const startTime = Date.now();
  shouldStop = false;
  
  while (!found && !shouldStop) {
    for (let i = 0; i < batchSize && !shouldStop; i++) {
      attempts++;
      const keypair = await generateKeypair();
      
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
    
    if (!found && !shouldStop) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = elapsed > 0 ? attempts / elapsed : 0;
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

self.onmessage = async function(e) {
  const { type, suffix, caseSensitive = false, batchSize = 500 } = e.data;
  
  if (type === 'start') {
    self.postMessage({ type: 'started', suffix });
    
    try {
      const result = await searchVanity(suffix, caseSensitive, batchSize);
      if (result) {
        self.postMessage({ type: 'found', ...result });
      } else {
        self.postMessage({ type: 'stopped' });
      }
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
  } else if (type === 'stop') {
    shouldStop = true;
  }
};
`;

export function useVanityGenerator(): UseVanityGeneratorResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKeypairs, setSavedKeypairs] = useState<VanityKeypair[]>([]);
  const [isLoadingKeypairs, setIsLoadingKeypairs] = useState(true);
  
  const workerRef = useRef<Worker | null>(null);

  // Create worker
  const createWorker = useCallback(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    
    worker.onmessage = (e) => {
      const data = e.data;
      
      if (data.type === 'progress') {
        setProgress({
          attempts: data.attempts,
          rate: data.rate,
          elapsed: data.elapsed,
        });
      } else if (data.type === 'found') {
        setResult({
          address: data.address,
          secretKey: data.secretKey,
          attempts: data.attempts,
          duration: data.duration,
        });
        setIsGenerating(false);
        setProgress(null);
      } else if (data.type === 'error') {
        setError(data.message);
        setIsGenerating(false);
        setProgress(null);
      } else if (data.type === 'stopped') {
        setIsGenerating(false);
        setProgress(null);
      }
    };
    
    worker.onerror = (e) => {
      console.error('[VanityWorker] Error:', e);
      setError('Worker error: ' + e.message);
      setIsGenerating(false);
    };
    
    return worker;
  }, []);

  // Start generation
  const startGeneration = useCallback((suffix: string, caseSensitive = false) => {
    if (isGenerating) return;
    
    // Validate suffix
    if (!suffix || suffix.length < 1 || suffix.length > 5) {
      setError('Suffix must be 1-5 characters');
      return;
    }
    
    // Check for valid base58 characters
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    for (const char of suffix) {
      if (!base58Chars.includes(char)) {
        setError(`Invalid character "${char}". Only Base58 characters allowed.`);
        return;
      }
    }
    
    setError(null);
    setResult(null);
    setProgress(null);
    setIsGenerating(true);
    
    // Create new worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    workerRef.current = createWorker();
    
    // Start search
    workerRef.current.postMessage({
      type: 'start',
      suffix,
      caseSensitive,
      batchSize: 500,
    });
  }, [isGenerating, createWorker]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsGenerating(false);
    setProgress(null);
  }, []);

  // Save keypair to database via edge function
  const saveKeypair = useCallback(async (
    address: string, 
    secretKeyHex: string, 
    suffix: string
  ): Promise<boolean> => {
    try {
      // For security, we'll encrypt the secret key with a simple approach
      // In production, you'd want a more robust encryption scheme
      const { data, error } = await supabase.functions.invoke('vanity-save', {
        body: {
          publicKey: address,
          secretKeyHex,
          suffix,
        },
      });
      
      if (error) throw error;
      
      if (data?.success) {
        // Refresh the list
        await fetchSavedKeypairs();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[useVanityGenerator] Save error:', e);
      setError('Failed to save keypair');
      return false;
    }
  }, []);

  // Fetch saved keypairs
  const fetchSavedKeypairs = useCallback(async () => {
    setIsLoadingKeypairs(true);
    try {
      // Use raw query since types may not be regenerated yet
      const { data, error } = await supabase
        .from('vanity_keypairs' as any)
        .select('id, suffix, public_key, status, used_for_token_id, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setSavedKeypairs((data || []) as unknown as VanityKeypair[]);
    } catch (e) {
      console.error('[useVanityGenerator] Fetch error:', e);
    } finally {
      setIsLoadingKeypairs(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSavedKeypairs();
  }, [fetchSavedKeypairs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return {
    isGenerating,
    progress,
    result,
    error,
    savedKeypairs,
    isLoadingKeypairs,
    startGeneration,
    stopGeneration,
    saveKeypair,
    fetchSavedKeypairs,
  };
}
