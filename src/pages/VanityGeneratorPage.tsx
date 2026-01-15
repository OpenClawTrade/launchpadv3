import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useVanityGenerator, VanityKeypair } from "@/hooks/useVanityGenerator";
import { 
  Key, 
  Zap, 
  Copy, 
  Check, 
  Loader2, 
  Save, 
  AlertTriangle,
  Cpu,
  Clock,
  Hash,
  ArrowLeft
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export default function VanityGeneratorPage() {
  const { toast } = useToast();
  const {
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
  } = useVanityGenerator();

  const [suffix, setSuffix] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStart = () => {
    if (!suffix.trim()) {
      toast({
        title: "Enter a suffix",
        description: "Please enter 1-5 characters for the address suffix",
        variant: "destructive",
      });
      return;
    }
    startGeneration(suffix.trim(), caseSensitive);
  };

  const handleSave = async () => {
    if (!result) return;
    
    setIsSaving(true);
    try {
      const success = await saveKeypair(result.address, result.secretKey, suffix);
      if (success) {
        toast({
          title: "Keypair Saved! 🔐",
          description: "Address stored securely for token launches",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const estimateTime = (suffixLength: number): string => {
    // Rough estimates based on base58 character set (58 chars)
    // Probability = (1/58)^n for case-sensitive
    // At ~500 keys/sec in browser
    const combinations = Math.pow(58, suffixLength);
    const avgAttempts = combinations / 2;
    const secondsEstimate = avgAttempts / 500;
    
    if (secondsEstimate < 60) return `~${Math.round(secondsEstimate)}s`;
    if (secondsEstimate < 3600) return `~${Math.round(secondsEstimate / 60)}min`;
    return `~${Math.round(secondsEstimate / 3600)}hrs`;
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/fun" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Key className="h-6 w-6 text-[#00d4aa]" />
            <span className="text-lg font-bold">Vanity Address Generator</span>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30">BETA</Badge>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generator Card */}
          <Card className="bg-[#12121a] border-[#1a1a1f] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-[#00d4aa]" />
              Generate Vanity Address
            </h2>
            
            <p className="text-sm text-gray-400 mb-4">
              Create Solana addresses with custom suffixes for your token launches. 
              The generated addresses will end with your chosen characters.
            </p>

            {/* Suffix Input */}
            <div className="space-y-3 mb-4">
              <label className="text-sm text-gray-300">Address Suffix (1-5 chars)</label>
              <Input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value.slice(0, 5))}
                placeholder="e.g., FUN, 420, PUMP"
                className="bg-[#0d0d0f] border-[#1a1a1f] text-white font-mono text-lg tracking-wider"
                disabled={isGenerating}
                maxLength={5}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="case-sensitive"
                    checked={caseSensitive}
                    onCheckedChange={(c) => setCaseSensitive(!!c)}
                    disabled={isGenerating}
                  />
                  <label htmlFor="case-sensitive" className="text-sm text-gray-400">
                    Case sensitive
                  </label>
                </div>
                
                {suffix && (
                  <span className="text-xs text-gray-500">
                    Est. time: {estimateTime(suffix.length)}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!isGenerating ? (
              <Button
                onClick={handleStart}
                disabled={!suffix.trim()}
                className="w-full bg-[#00d4aa] hover:bg-[#00b894] text-black font-semibold"
              >
                <Zap className="h-4 w-4 mr-2" />
                Start Generation
              </Button>
            ) : (
              <Button
                onClick={stopGeneration}
                variant="destructive"
                className="w-full"
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Stop Generation
              </Button>
            )}

            {/* Progress */}
            {isGenerating && progress && (
              <div className="mt-4 p-4 bg-[#0d0d0f] rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Searching...</span>
                  <span className="text-[#00d4aa] font-mono">{progress.rate} keys/sec</span>
                </div>
                <Progress value={Math.min((progress.elapsed / 300) * 100, 95)} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{progress.attempts.toLocaleString()} attempts</span>
                  <span>{progress.elapsed}s elapsed</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="mt-4 p-4 bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#00d4aa]">✓ Address Found!</span>
                  <span className="text-xs text-gray-400">
                    {result.attempts.toLocaleString()} attempts in {(result.duration / 1000).toFixed(1)}s
                  </span>
                </div>
                
                <div className="bg-[#0d0d0f] p-3 rounded font-mono text-sm break-all mb-3">
                  <span className="text-gray-300">{result.address.slice(0, -suffix.length)}</span>
                  <span className="text-[#00d4aa] font-bold">{result.address.slice(-suffix.length)}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(result.address)}
                    className="flex-1 border-[#2a2a35] bg-[#1a1a1f] hover:bg-[#252530]"
                  >
                    {copiedAddress === result.address ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-[#00d4aa] hover:bg-[#00b894] text-black"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save for Launch
                  </Button>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>How it works:</strong> Your browser generates random Solana keypairs 
                and checks if the address ends with your suffix. Longer suffixes take exponentially 
                longer to find. Generation happens locally in your browser.
              </p>
            </div>
          </Card>

          {/* Saved Keypairs */}
          <Card className="bg-[#12121a] border-[#1a1a1f] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Hash className="h-5 w-5 text-purple-400" />
                Saved Addresses
              </h2>
              <Badge variant="outline" className="border-[#2a2a35] text-gray-400">
                {savedKeypairs.length} total
              </Badge>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              These addresses are stored securely and will be used for future token launches 
              with matching suffixes.
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {isLoadingKeypairs ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="p-3 bg-[#0d0d0f] rounded-lg">
                    <Skeleton className="h-4 w-24 bg-[#1a1a1f] mb-2" />
                    <Skeleton className="h-4 w-full bg-[#1a1a1f]" />
                  </div>
                ))
              ) : savedKeypairs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No saved addresses yet</p>
                  <p className="text-xs mt-1">Generate and save your first vanity address</p>
                </div>
              ) : (
                savedKeypairs.map((keypair) => (
                  <KeypairCard 
                    key={keypair.id} 
                    keypair={keypair} 
                    onCopy={copyToClipboard}
                    isCopied={copiedAddress === keypair.public_key}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Estimation Table */}
        <Card className="bg-[#12121a] border-[#1a1a1f] p-6 mt-6">
          <h3 className="font-semibold text-white mb-4">Generation Time Estimates</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {[1, 2, 3, 4, 5].map((len) => (
              <div key={len} className="p-3 bg-[#0d0d0f] rounded-lg">
                <div className="text-2xl font-bold text-[#00d4aa]">{len}</div>
                <div className="text-xs text-gray-400">characters</div>
                <div className="text-sm text-gray-300 mt-2">{estimateTime(len)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            * Estimates based on ~500 keys/second. Actual times may vary depending on your device.
          </p>
        </Card>
      </div>
    </div>
  );
}

// Keypair Card Component
function KeypairCard({ 
  keypair, 
  onCopy, 
  isCopied 
}: { 
  keypair: VanityKeypair; 
  onCopy: (text: string) => void;
  isCopied: boolean;
}) {
  return (
    <div className="p-3 bg-[#0d0d0f] rounded-lg border border-[#1a1a1f] hover:border-[#2a2a35] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Badge 
          className={
            keypair.status === 'available' 
              ? 'bg-green-500/10 text-green-400 border-green-500/30'
              : keypair.status === 'reserved'
              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
          }
        >
          {keypair.status}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(keypair.created_at), { addSuffix: true })}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm truncate flex-1 mr-2">
          <span className="text-gray-400">{keypair.public_key.slice(0, 8)}...</span>
          <span className="text-[#00d4aa] font-bold">{keypair.suffix.toUpperCase()}</span>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCopy(keypair.public_key)}
          className="text-gray-400 hover:text-white"
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
