import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Hash, Loader2, CheckCircle2, X, Sparkles } from "lucide-react";

interface VanityKeypair {
  address: string;
  secretKeyHex: string;
}

interface GenerationProgress {
  attempts: number;
  rate: number;
  elapsed: number;
  workersActive: number;
}

interface VanityAddressGeneratorProps {
  onKeypairGenerated: (keypair: VanityKeypair | null) => void;
  disabled?: boolean;
}

// Web Worker code for vanity address mining
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
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function createSuffixMatcher(suffix, caseSensitive) {
  const target = caseSensitive ? suffix : suffix.toLowerCase();
  const len = target.length;
  return (address) => {
    const end = caseSensitive ? address.slice(-len) : address.slice(-len).toLowerCase();
    return end === target;
  };
}

let shouldStop = false;
let totalAttempts = 0;

async function searchVanity(suffix, caseSensitive, workerId) {
  const matchSuffix = createSuffixMatcher(suffix, caseSensitive);
  const startTime = Date.now();
  shouldStop = false;
  totalAttempts = 0;
  
  const BATCH_SIZE = 50;
  const REPORT_INTERVAL = 500;
  
  while (!shouldStop) {
    for (let i = 0; i < BATCH_SIZE && !shouldStop; i++) {
      totalAttempts++;
      
      try {
        const keyPair = await crypto.subtle.generateKey(
          { name: 'Ed25519' },
          true,
          ['sign', 'verify']
        );
        
        const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const publicKeyBytes = new Uint8Array(publicKeyBuffer);
        const address = base58Encode(publicKeyBytes);
        
        if (matchSuffix(address)) {
          const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
          const privateKeyBytes = new Uint8Array(privateKeyBuffer);
          const seed = privateKeyBytes.slice(16, 48);
          const fullSecretKey = new Uint8Array(64);
          fullSecretKey.set(seed, 0);
          fullSecretKey.set(publicKeyBytes, 32);
          
          return {
            address,
            secretKey: toHex(fullSecretKey),
            attempts: totalAttempts,
            duration: Date.now() - startTime,
          };
        }
      } catch (e) {
        if (e.name === 'NotSupportedError') {
          self.postMessage({ 
            type: 'error', 
            message: 'Ed25519 not supported. Use Chrome 113+ or Edge 113+.',
            workerId 
          });
          return null;
        }
        continue;
      }
    }
    
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

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const getWorkerCount = () => {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(2, Math.min(cores - 1, 6));
};

export function VanityAddressGenerator({ onKeypairGenerated, disabled }: VanityAddressGeneratorProps) {
  const [enabled, setEnabled] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<VanityKeypair | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const workersRef = useRef<Worker[]>([]);
  const progressRef = useRef<Map<number, { attempts: number; rate: number }>>(new Map());
  const startTimeRef = useRef<number>(0);
  const foundRef = useRef<boolean>(false);

  // Validate suffix
  const validateSuffix = (value: string): string | null => {
    if (!value) return null;
    if (value.length > 5) return "Max 5 characters";
    for (const char of value) {
      if (!BASE58_CHARS.includes(char)) {
        return `Invalid char "${char}"`;
      }
    }
    return null;
  };

  const suffixError = validateSuffix(suffix);
  const isValidSuffix = suffix.length >= 1 && suffix.length <= 5 && !suffixError;

  // Create worker
  const createWorker = useCallback((workerId: number, targetSuffix: string) => {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e) => {
      const data = e.data;

      if (data.type === "progress") {
        progressRef.current.set(data.workerId, {
          attempts: data.attempts,
          rate: data.rate,
        });

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
      } else if (data.type === "found" && !foundRef.current) {
        foundRef.current = true;

        // Stop all workers
        workersRef.current.forEach((w) => {
          w.postMessage({ type: "stop" });
          w.terminate();
        });
        workersRef.current = [];

        const keypair = {
          address: data.address,
          secretKeyHex: data.secretKey,
        };
        setResult(keypair);
        setIsGenerating(false);
        setProgress(null);
        onKeypairGenerated(keypair);
      } else if (data.type === "error") {
        setError(data.message);
        setIsGenerating(false);
      }
    };

    worker.onerror = (e) => {
      console.error("[VanityWorker] Error:", e);
      setError("Worker error occurred");
    };

    worker.postMessage({
      type: "start",
      suffix: targetSuffix,
      caseSensitive: false,
      workerId,
    });

    return worker;
  }, [onKeypairGenerated]);

  // Start generation
  const startGeneration = useCallback(() => {
    if (isGenerating || !isValidSuffix) return;

    setError(null);
    setResult(null);
    setProgress(null);
    setIsGenerating(true);
    foundRef.current = false;
    progressRef.current.clear();
    startTimeRef.current = Date.now();

    // Terminate existing workers
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current = [];

    const workerCount = getWorkerCount();

    for (let i = 0; i < workerCount; i++) {
      const worker = createWorker(i, suffix);
      workersRef.current.push(worker);
    }
  }, [isGenerating, isValidSuffix, suffix, createWorker]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    workersRef.current.forEach((w) => {
      w.postMessage({ type: "stop" });
      w.terminate();
    });
    workersRef.current = [];
    progressRef.current.clear();
    setIsGenerating(false);
    setProgress(null);
  }, []);

  // Reset/clear result
  const resetResult = useCallback(() => {
    setResult(null);
    setSuffix("");
    onKeypairGenerated(null);
  }, [onKeypairGenerated]);

  // Toggle enabled
  const handleToggle = useCallback((checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      stopGeneration();
      resetResult();
    }
  }, [stopGeneration, resetResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workersRef.current.forEach((w) => w.terminate());
    };
  }, []);

  // Estimate time based on suffix length
  const getEstimate = (len: number) => {
    const estimates: Record<number, string> = {
      1: "< 1 sec",
      2: "1-5 sec",
      3: "30-60 sec",
      4: "5-15 min",
      5: "1-4 hours",
    };
    return estimates[len] || "varies";
  };

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Custom Mint Address</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={disabled || isGenerating}
        />
      </div>

      {enabled && (
        <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          {/* Result display */}
          {result ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Address Found!</span>
              </div>
              <div className="p-2 rounded bg-background/50 border border-border">
                <code className="text-xs font-mono text-foreground break-all">
                  {result.address}
                </code>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Ends with <span className="text-primary font-semibold">{suffix}</span></span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetResult}
                className="w-full text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Clear & Generate New
              </Button>
            </div>
          ) : (
            <>
              {/* Suffix input */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter suffix (e.g. PUMP)"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value.slice(0, 5))}
                    disabled={isGenerating}
                    className="gate-input font-mono text-sm"
                    maxLength={5}
                  />
                </div>
                {suffix && (
                  <div className="flex justify-between text-xs">
                    <span className={suffixError ? "text-destructive" : "text-muted-foreground"}>
                      {suffixError || `${suffix.length}/5 chars`}
                    </span>
                    <span className="text-muted-foreground">
                      Est: {getEstimate(suffix.length)}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress display */}
              {isGenerating && progress && (
                <div className="space-y-2">
                  <Progress value={Math.min((progress.attempts / 1000000) * 100, 95)} className="h-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.attempts.toLocaleString()} attempts</span>
                    <span>{progress.rate.toLocaleString()} keys/sec</span>
                    <span>{progress.elapsed}s</span>
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              {/* Generate/Stop button */}
              <Button
                onClick={isGenerating ? stopGeneration : startGeneration}
                disabled={!isValidSuffix && !isGenerating}
                variant={isGenerating ? "destructive" : "secondary"}
                className="w-full"
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mining... (Stop)
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4 mr-2" />
                    Generate Address
                  </>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Address will end with your suffix. Mining happens in your browser.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
