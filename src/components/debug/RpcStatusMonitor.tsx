import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRpcUrl } from '@/hooks/useSolanaWallet';
import { Connection } from '@solana/web3.js';

interface RpcStatus {
  url: string;
  source: string;
  isConnected: boolean;
  latency: number | null;
  blockHeight: number | null;
  error: string | null;
  lastChecked: Date | null;
}

interface ConfigStatus {
  localStorage: string | null;
  windowConfig: string | null;
  viteEnv: string | null;
  resolvedUrl: string;
  resolvedSource: string;
}

export function RpcStatusMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [rpcStatus, setRpcStatus] = useState<RpcStatus>({
    url: '',
    source: '',
    isConnected: false,
    latency: null,
    blockHeight: null,
    error: null,
    lastChecked: null,
  });
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    localStorage: null,
    windowConfig: null,
    viteEnv: null,
    resolvedUrl: '',
    resolvedSource: '',
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkRpcConnection = useCallback(async () => {
    setIsChecking(true);
    const startTime = Date.now();

    try {
      const { url, source } = getRpcUrl();
      
      // Get config sources for debugging
      const localStorageUrl = localStorage.getItem('heliusRpcUrl');
      const windowConfigUrl = (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl;
      const viteEnvUrl = import.meta.env.VITE_HELIUS_RPC_URL;

      setConfigStatus({
        localStorage: localStorageUrl || null,
        windowConfig: windowConfigUrl || null,
        viteEnv: viteEnvUrl || null,
        resolvedUrl: url,
        resolvedSource: source,
      });


      const connection = new Connection(url, 'confirmed');
      const blockHeight = await connection.getBlockHeight();
      const latency = Date.now() - startTime;

      setRpcStatus({
        url,
        source,
        isConnected: true,
        latency,
        blockHeight,
        error: null,
        lastChecked: new Date(),
      });

    } catch (error: any) {
      const latency = Date.now() - startTime;
      const { url, source } = getRpcUrl();
      
      const errorMsg = error?.message || 'Unknown error';
      console.error('[RpcStatusMonitor] RPC FAILED:', {
        error: errorMsg,
        url: url.substring(0, 60),
        source,
        latency: `${latency}ms`,
      });

      setRpcStatus({
        url,
        source,
        isConnected: false,
        latency,
        blockHeight: null,
        error: errorMsg,
        lastChecked: new Date(),
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkRpcConnection();
    const interval = setInterval(checkRpcConnection, 30000);
    return () => clearInterval(interval);
  }, [checkRpcConnection]);

  // Keyboard shortcut: Ctrl+Shift+R
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearAndRefresh = useCallback(() => {
    localStorage.removeItem('heliusRpcUrl');
    window.location.reload();
  }, []);

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className={cn(
          "fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full shadow-lg",
          rpcStatus.isConnected 
            ? "bg-primary/15 hover:bg-primary/20 border border-primary/30" 
            : "bg-destructive/15 hover:bg-destructive/20 border border-destructive/30"
        )}
        title="RPC Status (Ctrl+Shift+R)"
      >
        {rpcStatus.isConnected ? (
          <Wifi className="h-4 w-4 text-primary" />
        ) : (
          <WifiOff className="h-4 w-4 text-destructive" />
        )}
      </Button>
    );
  }

  const urlPreview = (url: string | null) => {
    if (!url) return 'Not set';
    if (url.includes('helius')) return `✅ Helius: ...${url.slice(-20)}`;
    if (url.includes('publicnode')) return '⚠️ PublicNode (fallback)';
    if (url.includes('vercel')) return `❌ Vercel URL (wrong!)`;
    return url.substring(0, 40) + '...';
  };

  return (
    <Card className={cn(
      "fixed bottom-4 left-4 z-50 bg-card border shadow-2xl transition-all duration-200",
      isExpanded ? "w-[380px]" : "w-[280px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          {rpcStatus.isConnected ? (
            <Wifi className="h-4 w-4 text-primary" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm font-medium">RPC Status</span>
          <Badge variant={rpcStatus.isConnected ? "default" : "destructive"} className="text-xs">
            {rpcStatus.isConnected ? 'Connected' : 'Failed'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={checkRpcConnection}
            disabled={isChecking}
            className="h-6 w-6 p-0"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3 w-3", isChecking && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 text-xs font-mono">
        {/* Quick Status */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Source:</span>
          <span className={cn(
            rpcStatus.source.includes('localStorage') || rpcStatus.source.includes('HELIUS') 
              ? 'text-primary' 
              : rpcStatus.source.includes('fallback') 
                ? 'text-muted-foreground' 
                : 'text-foreground'
          )}>
            {rpcStatus.source || 'Unknown'}
          </span>
        </div>

        {rpcStatus.latency !== null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Latency:</span>
            <span className={cn(
              rpcStatus.latency < 500 ? 'text-primary' : 
              rpcStatus.latency < 1500 ? 'text-foreground' : 'text-destructive'
            )}>
              {rpcStatus.latency}ms
            </span>
          </div>
        )}

        {rpcStatus.blockHeight && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Block:</span>
            <span className="text-foreground">{rpcStatus.blockHeight.toLocaleString()}</span>
          </div>
        )}

        {rpcStatus.error && (
          <div className="p-2 bg-destructive/10 rounded border border-destructive/30">
            <span className="text-destructive">Error: {rpcStatus.error}</span>
          </div>
        )}

        {isExpanded && (
          <>
            <div className="border-t pt-2 mt-2">
              <span className="text-muted-foreground text-[10px] uppercase">Config Sources</span>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-muted-foreground">localStorage:</span>
                <div className="text-[10px] break-all">{urlPreview(configStatus.localStorage)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">window config:</span>
                <div className="text-[10px] break-all">{urlPreview(configStatus.windowConfig)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">VITE env:</span>
                <div className="text-[10px] break-all">{urlPreview(configStatus.viteEnv)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Resolved URL:</span>
                <div className="text-[10px] break-all">{urlPreview(configStatus.resolvedUrl)}</div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearAndRefresh}
              className="w-full text-xs h-7 mt-2"
            >
              Clear Cache & Reload
            </Button>
          </>
        )}

        {rpcStatus.lastChecked && (
          <div className="text-[10px] text-muted-foreground text-center">
            Last checked: {rpcStatus.lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>
    </Card>
  );
}
