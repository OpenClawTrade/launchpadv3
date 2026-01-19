import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, Database, Play, RefreshCw, Sparkles, Zap, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface VanityStats {
  total: number;
  available: number;
  reserved: number;
  used: number;
  suffixes: { suffix: string; count: number }[];
}

interface RecentAddress {
  id: string;
  suffix: string;
  publicKey: string;
  status: string;
  createdAt: string;
}

interface GenerationResult {
  found: number;
  attempts: number;
  duration: number;
  rate: number;
  addresses: string[];
}

interface LiveProgress {
  attempts: number;
  found: number;
  elapsed: number;
  rate: number;
  remaining: number;
  percentComplete: number;
  recentAddresses: string[];
}

const VanityAdminPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<VanityStats | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [authSecret, setAuthSecret] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const autoRunRef = useRef(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [sessionBatches, setSessionBatches] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionFound, setSessionFound] = useState(0);

  // Live progress during generation
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);

  const TARGET_AVAILABLE = 100;
  const MAX_AUTO_RUNS = 30;

  // Get auth secret from localStorage or prompt
  useEffect(() => {
    const stored = localStorage.getItem('vanity_auth_secret');
    if (stored) {
      setAuthSecret(stored);
    }
  }, []);

  const saveAuthSecret = (secret: string) => {
    localStorage.setItem('vanity_auth_secret', secret);
    setAuthSecret(secret);
  };

  const getBackendBaseUrl = () => {
    const normalize = (url: string) => url.replace(/\/+$/, '');

    const fromStorage = localStorage.getItem('meteoraApiUrl');
    if (fromStorage && fromStorage.startsWith('https://') && !fromStorage.includes('${')) {
      return normalize(fromStorage);
    }

    const fromWindow = (window as any)?.__PUBLIC_CONFIG__?.meteoraApiUrl as string | undefined;
    if (fromWindow && fromWindow.startsWith('https://') && !fromWindow.includes('${')) {
      return normalize(fromWindow);
    }

    return null;
  };

  const fetchStatus = useCallback(async () => {
    if (!authSecret) return;

    const backendBaseUrl = getBackendBaseUrl();
    if (!backendBaseUrl) {
      toast.error('Backend URL not configured yet — refresh the page');
      return;
    }

    try {
      const response = await fetch(`${backendBaseUrl}/api/vanity/status?suffix=67x`, {
        headers: {
          'x-vanity-secret': authSecret,
        },
      });

      if (response.status === 401) {
        toast.error('Invalid auth secret');
        localStorage.removeItem('vanity_auth_secret');
        setAuthSecret('');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setRecentAddresses(data.recentAddresses || []);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, [authSecret]);

  useEffect(() => {
    if (authSecret) {
      fetchStatus();
    } else {
      setIsLoading(false);
    }
  }, [authSecret, fetchStatus]);

  const triggerGenerationOnce = useCallback(async () => {
    if (!authSecret) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    
    // Track starting count to calculate found during this batch
    const startingAvailable = stats?.available || 0;
    
    const startTime = Date.now();
    const ESTIMATED_RATE = 3300;
    const MAX_DURATION = 55000;

    const backendBaseUrl = getBackendBaseUrl();
    if (!backendBaseUrl) {
      toast.error('Backend URL not configured yet — refresh the page');
      setIsGenerating(false);
      return null;
    }
    
    // Poll for real-time progress (found addresses are saved to DB immediately)
    const progressInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const estimatedAttempts = Math.round((elapsed / 1000) * ESTIMATED_RATE);
      const percentComplete = Math.min(99, Math.round((elapsed / MAX_DURATION) * 100));
      const remaining = Math.max(0, MAX_DURATION - elapsed);
      
      // Fetch real count from database
      try {
        const progressRes = await fetch(`${backendBaseUrl}/api/vanity/progress?suffix=67x`, {
          headers: { 'x-vanity-secret': authSecret },
        });
        const progressData = await progressRes.json();
        
        if (progressData.success) {
          const realFound = Math.max(0, progressData.available - startingAvailable);
          setLiveProgress(prev => ({
            attempts: estimatedAttempts,
            found: realFound,
            elapsed,
            rate: ESTIMATED_RATE,
            remaining,
            percentComplete,
            recentAddresses: prev?.recentAddresses || [],
          }));
        }
      } catch {
        // If poll fails, just update estimates
        setLiveProgress(prev => ({
          attempts: estimatedAttempts,
          found: prev?.found || 0,
          elapsed,
          rate: ESTIMATED_RATE,
          remaining,
          percentComplete,
          recentAddresses: prev?.recentAddresses || [],
        }));
      }
    }, 2000); // Poll every 2 seconds

    try {
      const response = await fetch(`${backendBaseUrl}/api/vanity/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vanity-secret': authSecret,
        },
        body: JSON.stringify({
          suffix: '67x',
          targetCount: TARGET_AVAILABLE,
        }),
        signal: controller.signal,
      });

      clearInterval(progressInterval);

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Generation failed');
        return null;
      }

      const result: GenerationResult = {
        found: data.batch?.found || 0,
        attempts: data.batch?.attempts || 0,
        duration: data.batch?.duration || 0,
        rate: data.batch?.rate || 0,
        addresses: data.newAddresses || [],
      };

      setLastResult(result);
      setStats(data.stats);
      setSessionBatches((v) => v + 1);
      setSessionAttempts((v) => v + result.attempts);
      setSessionFound((v) => v + result.found);

      if (result.found > 0) {
        toast.success(`Found ${result.found} new addresses!`);
      }

      setLiveProgress(null);
      return { batch: result, stats: data.stats };
    } catch (error) {
      clearInterval(progressInterval);
      if ((error as any)?.name !== 'AbortError') {
        console.error('Generation error:', error);
        toast.error('Generation failed');
      }
      return null;
    } finally {
      setIsGenerating(false);
      setLiveProgress(null);
    }
  }, [authSecret, stats?.available]);

  const stopAutoRun = useCallback(() => {
    autoRunRef.current = false;
    setIsAutoRunning(false);
    abortRef.current?.abort();
  }, []);

  const startAutoRun = useCallback(async () => {
    if (!authSecret) return;

    autoRunRef.current = true;
    setIsAutoRunning(true);
    
    for (let i = 0; i < MAX_AUTO_RUNS; i++) {
      // Use ref to check if we should stop (avoids stale closure)
      if (!autoRunRef.current) break;

      const data = await triggerGenerationOnce();
      if (!data) break;

      await fetchStatus();

      const available = data?.stats?.available ?? 0;
      if (available >= TARGET_AVAILABLE) {
        toast.success(`Target reached: ${available}/${TARGET_AVAILABLE} available`);
        break;
      }
    }

    autoRunRef.current = false;
    setIsAutoRunning(false);
  }, [authSecret, fetchStatus, triggerGenerationOnce]);

  if (!authSecret) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto mt-20">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Vanity Generator Admin
              </CardTitle>
            <CardDescription>
                Enter admin password to authenticate
            </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="password"
                placeholder="Auth secret..."
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveAuthSecret((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to authenticate
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Vanity Generator Admin
                </h1>
                <p className="text-sm text-muted-foreground">
                  Server-side 67x address generation
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <p className="text-3xl font-bold mt-2">{stats?.total || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Available</span>
              </div>
              <p className="text-3xl font-bold text-green-500 mt-2">{stats?.available || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Reserved</span>
              </div>
              <p className="text-3xl font-bold text-yellow-500 mt-2">{stats?.reserved || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Used</span>
              </div>
              <p className="text-3xl font-bold text-blue-500 mt-2">{stats?.used || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Generation Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Generate Addresses
            </CardTitle>
            <CardDescription>
              Run server-side generation to build up the vanity address pool.
              Each run takes ~55 seconds and generates addresses ending in "67x".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={triggerGenerationOnce}
                disabled={isGenerating || isAutoRunning}
                className="flex-1"
                size="lg"
              >
                {isGenerating && !isAutoRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run One Batch
                  </>
                )}
              </Button>
              <Button
                onClick={isAutoRunning ? stopAutoRun : startAutoRun}
                disabled={isGenerating && !isAutoRunning}
                variant={isAutoRunning ? "destructive" : "default"}
                className="flex-1"
                size="lg"
              >
                {isAutoRunning ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Auto-Run
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Auto-Run to {TARGET_AVAILABLE}
                  </>
                )}
              </Button>
            </div>

            {/* Live Progress During Generation */}
            {liveProgress && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-green-500 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Live...
                  </h4>
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    {liveProgress.percentComplete}%
                  </Badge>
                </div>
                
                <Progress value={liveProgress.percentComplete} className="h-3" />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-xl font-bold font-mono text-green-500">{liveProgress.found}</div>
                    <div className="text-muted-foreground text-xs">Found</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-xl font-bold font-mono">{liveProgress.attempts.toLocaleString()}</div>
                    <div className="text-muted-foreground text-xs">Attempts</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-xl font-bold font-mono">{liveProgress.rate.toLocaleString()}/s</div>
                    <div className="text-muted-foreground text-xs">Rate</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-xl font-bold font-mono">{Math.round(liveProgress.remaining / 1000)}s</div>
                    <div className="text-muted-foreground text-xs">Remaining</div>
                  </div>
                </div>
                
                {liveProgress.recentAddresses.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Recently found:</span>
                    <div className="flex flex-wrap gap-2">
                      {liveProgress.recentAddresses.map((addr) => (
                        <Badge key={addr} className="bg-green-500/20 text-green-500 font-mono text-xs">
                          ...{addr.slice(-6)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Stats */}
            {(sessionBatches > 0 || isAutoRunning) && !liveProgress && (
              <div className="p-4 bg-primary/10 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-primary">Session Progress</h4>
                  {isAutoRunning && (
                    <Badge variant="outline" className="animate-pulse">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Running
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold font-mono">{sessionBatches}</div>
                    <div className="text-muted-foreground text-xs">Batches</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold font-mono">{sessionAttempts.toLocaleString()}</div>
                    <div className="text-muted-foreground text-xs">Attempts</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded">
                    <div className="text-2xl font-bold font-mono text-green-500">{sessionFound}</div>
                    <div className="text-muted-foreground text-xs">Found</div>
                  </div>
                </div>
                {stats && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Pool Progress</span>
                      <span className="font-mono">{stats.available} / {TARGET_AVAILABLE}</span>
                    </div>
                    <Progress value={(stats.available / TARGET_AVAILABLE) * 100} className="h-2" />
                  </div>
                )}
              </div>
            )}

            {lastResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold">Last Generation Result</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Found:</span>
                    <span className="ml-2 font-mono">{lastResult.found}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Attempts:</span>
                    <span className="ml-2 font-mono">{lastResult.attempts.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate:</span>
                    <span className="ml-2 font-mono">{lastResult.rate.toLocaleString()}/s</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-mono">{Math.round(lastResult.duration / 1000)}s</span>
                  </div>
                </div>
                {lastResult.addresses && lastResult.addresses.length > 0 && (
                  <div className="mt-2">
                    <span className="text-muted-foreground text-sm">New addresses:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {lastResult.addresses.map((addr) => (
                        <Badge key={addr} variant="secondary" className="font-mono text-xs">
                          {addr.slice(0, 4)}...{addr.slice(-6)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Addresses */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Addresses</CardTitle>
            <CardDescription>
              Last 20 generated vanity addresses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentAddresses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No addresses generated yet
              </p>
            ) : (
              <div className="space-y-2">
                {recentAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          addr.status === 'available'
                            ? 'default'
                            : addr.status === 'reserved'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={
                          addr.status === 'available'
                            ? 'bg-green-500/20 text-green-500'
                            : addr.status === 'used'
                            ? 'bg-blue-500/20 text-blue-500'
                            : ''
                        }
                      >
                        {addr.status}
                      </Badge>
                      <code className="font-mono text-sm">
                        {addr.publicKey.slice(0, 8)}...
                        <span className="text-primary font-bold">{addr.publicKey.slice(-6)}</span>
                      </code>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(addr.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suffix Breakdown */}
        {stats?.suffixes && stats.suffixes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suffix Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.suffixes.map(({ suffix, count }) => (
                  <div key={suffix} className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {suffix}
                    </Badge>
                    <Progress value={(count / stats.total) * 100} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VanityAdminPage;
