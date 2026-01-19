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

const VanityAdminPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<VanityStats | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [authSecret, setAuthSecret] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [sessionBatches, setSessionBatches] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionFound, setSessionFound] = useState(0);

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

  const VERCEL_API_BASE = 'https://trenchespost.vercel.app';

  const fetchStatus = useCallback(async () => {
    if (!authSecret) return;

    try {
      const response = await fetch(`${VERCEL_API_BASE}/api/vanity/status?suffix=67x`, {
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
    try {
      const response = await fetch(`${VERCEL_API_BASE}/api/vanity/batch`, {
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

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Generation failed');
        return null;
      }

      setLastResult(data.batch);
      setStats(data.stats);
      setSessionBatches((v) => v + 1);
      setSessionAttempts((v) => v + (data.batch?.attempts || 0));
      setSessionFound((v) => v + (data.batch?.found || 0));

      return data;
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
        console.error('Generation error:', error);
        toast.error('Generation failed');
      }
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [authSecret]);

  const stopAutoRun = useCallback(() => {
    setIsAutoRunning(false);
    abortRef.current?.abort();
  }, []);

  const startAutoRun = useCallback(async () => {
    if (!authSecret) return;

    setIsAutoRunning(true);
    for (let i = 0; i < MAX_AUTO_RUNS; i++) {
      if (!isAutoRunning) break;

      const data = await triggerGenerationOnce();
      if (!data) break;

      await fetchStatus();

      const available = data?.stats?.available ?? 0;
      if (available >= TARGET_AVAILABLE) {
        toast.success(`Target reached: ${available}/${TARGET_AVAILABLE} available`);
        break;
      }
    }

    setIsAutoRunning(false);
  }, [authSecret, fetchStatus, isAutoRunning, triggerGenerationOnce]);

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
            <Button
              onClick={triggerGeneration}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating... (this takes ~55 seconds)
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Start Generation Batch
                </>
              )}
            </Button>

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
                {lastResult.addresses.length > 0 && (
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
