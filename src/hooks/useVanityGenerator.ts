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
  workersActive: number;
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

// Highly optimized worker code using @noble/ed25519 for maximum speed
const workerCode = `
importScripts('https://unpkg.com/@noble/ed25519@2.1.0/lib/index.min.js');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Pre-compute lookup for fast suffix matching
function createSuffixMatcher(suffix, caseSensitive) {
  const target = caseSensitive ? suffix : suffix.toLowerCase();
  const len = target.length;
  return (address) => {
    const end = caseSensitive ? address.slice(-len) : address.slice(-len).toLowerCase();
    return end === target;
  };
}

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
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

let shouldStop = false;
let totalAttempts = 0;

// Ultra-fast batch generation using noble/ed25519
async function searchVanity(suffix, caseSensitive, workerId) {
  const matchSuffix = createSuffixMatcher(suffix, caseSensitive);
  const startTime = Date.now();
  shouldStop = false;
  totalAttempts = 0;
  
  // Use larger batch sizes for speed
  const BATCH_SIZE = 200;
  const REPORT_INTERVAL = 1000; // Report every 1000 attempts
  
  while (!shouldStop) {
    // Generate batch of random seeds
    for (let i = 0; i < BATCH_SIZE && !shouldStop; i++) {
      totalAttempts++;
      
      // Generate random 32-byte seed
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);
      
      try {
        // Use noble/ed25519 for fast key derivation
        const publicKey = await nobleEd25519.getPublicKeyAsync(seed);
        const address = base58Encode(publicKey);
        
        if (matchSuffix(address)) {
          // Found! Build full secret key (64 bytes: seed + public key)
          const fullSecretKey = new Uint8Array(64);
          fullSecretKey.set(seed, 0);
          fullSecretKey.set(publicKey, 32);
          
          return {
            address,
            secretKey: toHex(fullSecretKey),
            attempts: totalAttempts,
            duration: Date.now() - startTime,
          };
        }
      } catch (e) {
        // Skip invalid seeds (rare)
        continue;
      }
    }
    
    // Report progress periodically
    if (totalAttempts % REPORT_INTERVAL === 0 && !shouldStop) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = elapsed > 0 ? totalAttempts / elapsed : 0;
      self.postMessage({
        type: 'progress',
        attempts: totalAttempts,
        rate: Math.round(rate),
        elapsed: Math.round(elapsed),
        workerId,
      });
    }
  }
  
  return null;
}

self.onmessage = async function(e) {
  const { type, suffix, caseSensitive = false, workerId = 0 } = e.data;
  
  if (type === 'start') {
    self.postMessage({ type: 'started', suffix, workerId });
    
    try {
      const result = await searchVanity(suffix, caseSensitive, workerId);
      if (result) {
        self.postMessage({ type: 'found', ...result, workerId });
      } else {
        self.postMessage({ type: 'stopped', workerId });
      }
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message, workerId });
    }
  } else if (type === 'stop') {
    shouldStop = true;
  }
};
`;

// Number of parallel workers based on hardware concurrency
const getWorkerCount = () => {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(2, Math.min(cores - 1, 8)); // Use 2-8 workers
};

export function useVanityGenerator(): UseVanityGeneratorResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKeypairs, setSavedKeypairs] = useState<VanityKeypair[]>([]);
  const [isLoadingKeypairs, setIsLoadingKeypairs] = useState(true);
  
  const workersRef = useRef<Worker[]>([]);
  const progressRef = useRef<Map<number, { attempts: number; rate: number }>>(new Map());
  const startTimeRef = useRef<number>(0);
  const foundRef = useRef<boolean>(false);

  // Create worker
  const createWorker = useCallback((workerId: number, suffix: string, caseSensitive: boolean) => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    
    worker.onmessage = (e) => {
      const data = e.data;
      
      if (data.type === 'progress') {
        progressRef.current.set(data.workerId, {
          attempts: data.attempts,
          rate: data.rate,
        });
        
        // Aggregate progress from all workers
        let totalAttempts = 0;
        let totalRate = 0;
        progressRef.current.forEach((p) => {
          totalAttempts += p.attempts;
          totalRate += p.rate;
        });
        
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        setProgress({
          attempts: totalAttempts,
          rate: totalRate,
          elapsed,
          workersActive: progressRef.current.size,
        });
      } else if (data.type === 'found' && !foundRef.current) {
        foundRef.current = true;
        
        // Stop all workers
        workersRef.current.forEach(w => {
          w.postMessage({ type: 'stop' });
          w.terminate();
        });
        workersRef.current = [];
        
        setResult({
          address: data.address,
          secretKey: data.secretKey,
          attempts: data.attempts,
          duration: data.duration,
        });
        setIsGenerating(false);
        setProgress(null);
      } else if (data.type === 'error') {
        console.error(`[Worker ${data.workerId}] Error:`, data.message);
      }
    };
    
    worker.onerror = (e) => {
      console.error('[VanityWorker] Error:', e);
    };
    
    // Start immediately
    worker.postMessage({
      type: 'start',
      suffix,
      caseSensitive,
      workerId,
    });
    
    return worker;
  }, []);

  // Start generation with multiple parallel workers
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
    foundRef.current = false;
    progressRef.current.clear();
    startTimeRef.current = Date.now();
    
    // Terminate existing workers
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
    
    // Create multiple parallel workers
    const workerCount = getWorkerCount();
    console.log(`[VanityGenerator] Starting ${workerCount} parallel workers for suffix "${suffix}"`);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = createWorker(i, suffix, caseSensitive);
      workersRef.current.push(worker);
    }
  }, [isGenerating, createWorker]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    workersRef.current.forEach(w => {
      w.postMessage({ type: 'stop' });
      w.terminate();
    });
    workersRef.current = [];
    progressRef.current.clear();
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
      const { data, error } = await supabase.functions.invoke('vanity-save', {
        body: {
          publicKey: address,
          secretKeyHex,
          suffix,
        },
      });
      
      if (error) throw error;
      
      if (data?.success) {
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
      workersRef.current.forEach(w => w.terminate());
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
