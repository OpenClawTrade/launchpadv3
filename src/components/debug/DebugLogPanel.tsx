import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  getLogs, 
  getLogsAsText, 
  getLogsAsJson, 
  clearLogs, 
  uploadLogs,
  getErrorCount,
  type LogEntry 
} from '@/lib/debugLogger';
import { 
  Bug, 
  X, 
  Copy, 
  Download, 
  Trash2, 
  Upload, 
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DebugLogPanelProps {
  defaultOpen?: boolean;
}

export function DebugLogPanel({ defaultOpen = false }: DebugLogPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Update logs when events fire
  useEffect(() => {
    const updateLogs = () => {
      setLogs(getLogs());
      setErrorCount(getErrorCount());
    };

    updateLogs();

    const handleLogAdded = () => {
      updateLogs();
      // Auto-scroll to bottom
      if (autoScrollRef.current && scrollRef.current) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
      }
    };

    const handleLogsCleared = () => {
      updateLogs();
    };

    window.addEventListener('debug-log-added', handleLogAdded);
    window.addEventListener('debug-logs-cleared', handleLogsCleared);

    return () => {
      window.removeEventListener('debug-log-added', handleLogAdded);
      window.removeEventListener('debug-logs-cleared', handleLogsCleared);
    };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getLogsAsText());
    toast({ title: 'Copied!', description: 'Logs copied to clipboard' });
  }, [toast]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([getLogsAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'Logs saved as JSON' });
  }, [toast]);

  const handleClear = useCallback(() => {
    clearLogs();
    toast({ title: 'Cleared!', description: 'All logs cleared' });
  }, [toast]);

  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    const result = await uploadLogs();
    setIsUploading(false);
    
    if (result.success) {
      toast({ title: 'Uploaded!', description: 'Logs saved to backend' });
    } else {
      toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
    }
  }, [toast]);

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-foreground';
    }
  };

  const getLevelBg = (level: string): string => {
    switch (level) {
      case 'error': return 'bg-red-500/10';
      case 'warn': return 'bg-yellow-500/10';
      default: return '';
    }
  };

  // Collapsed state - just show icon
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full bg-card border border-border shadow-lg hover:bg-accent"
        title="Open Debug Panel (Ctrl+Shift+D)"
      >
        <Bug className="h-4 w-4" />
        {errorCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {errorCount > 9 ? '9+' : errorCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 bg-card border border-border shadow-2xl transition-all duration-200",
      isMinimized ? "w-80 h-12" : "w-[420px] h-[50vh] max-h-[500px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Debug Logs</span>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              {errorCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
            title="Close (Ctrl+Shift+D)"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Actions */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 px-2 text-xs">
              <Download className="h-3 w-3 mr-1" /> JSON
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleUpload} 
              disabled={isUploading || logs.length === 0}
              className="h-7 px-2 text-xs"
            >
              <Upload className={cn("h-3 w-3 mr-1", isUploading && "animate-pulse")} /> 
              {isUploading ? '...' : 'Upload'}
            </Button>
            <div className="flex-1" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClear} 
              disabled={logs.length === 0}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          {/* Log entries */}
          <ScrollArea className="flex-1 h-[calc(100%-80px)]" ref={scrollRef}>
            <div className="p-2 space-y-0.5 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No logs yet. Try launching a token.
                </div>
              ) : (
                logs.map((log) => (
                  <div 
                    key={log.id} 
                    className={cn(
                      "flex items-start gap-2 py-1 px-2 rounded",
                      getLevelBg(log.level)
                    )}
                  >
                    <span className="text-muted-foreground shrink-0">{log.elapsed}</span>
                    <span className={cn("shrink-0 w-12", getLevelColor(log.level))}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-foreground break-all">
                      {log.message}
                      {log.data && (
                        <span className="text-muted-foreground ml-1">
                          {JSON.stringify(log.data)}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
