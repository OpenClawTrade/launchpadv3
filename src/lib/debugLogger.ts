/**
 * Debug Logger - Captures frontend logs with timestamps for debugging
 * Stores in memory + localStorage, with optional backend upload
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  elapsed: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

interface DebugLoggerState {
  logs: LogEntry[];
  startTime: number | null;
  sessionId: string;
  maxLogs: number;
}

const STORAGE_KEY = 'rift_debug_logs';
const SESSION_KEY = 'rift_debug_session';
const MAX_LOGS = 500;

// Generate unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format elapsed time as MM:SS.mmm
function formatElapsed(startTime: number, now: number): string {
  const elapsed = now - startTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const ms = elapsed % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Singleton state
const state: DebugLoggerState = {
  logs: [],
  startTime: null,
  sessionId: '',
  maxLogs: MAX_LOGS,
};

// Initialize from localStorage
function init() {
  if (typeof window === 'undefined') return;
  
  try {
    // Get or create session ID
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    state.sessionId = sessionId;
    
    // Load persisted logs
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.sessionId === sessionId) {
        state.logs = parsed.logs || [];
        state.startTime = parsed.startTime || null;
      }
    }
  } catch (e) {
    console.warn('[DebugLogger] Failed to load from storage:', e);
  }
}

// Save to localStorage
function persist() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId: state.sessionId,
      logs: state.logs,
      startTime: state.startTime,
    }));
  } catch (e) {
    // Storage full or unavailable - trim logs
    if (state.logs.length > 100) {
      state.logs = state.logs.slice(-100);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          sessionId: state.sessionId,
          logs: state.logs,
          startTime: state.startTime,
        }));
      } catch {
        // Give up on persistence
      }
    }
  }
}

// Initialize on module load
init();

/**
 * Add a log entry
 */
export function debugLog(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  const now = Date.now();
  
  // Set start time on first log
  if (state.startTime === null) {
    state.startTime = now;
  }
  
  const entry: LogEntry = {
    id: `${now}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: now,
    elapsed: formatElapsed(state.startTime, now),
    level,
    message,
    data,
  };
  
  state.logs.push(entry);
  
  // Trim if needed
  if (state.logs.length > state.maxLogs) {
    state.logs = state.logs.slice(-state.maxLogs);
  }
  
  // Persist
  persist();
  
  // Also log to console with prefix
  const consoleMethod = level === 'error' ? console.error 
    : level === 'warn' ? console.warn 
    : level === 'debug' ? console.debug 
    : console.log;
  
  consoleMethod(`[${entry.elapsed}] [${level.toUpperCase()}] ${message}`, data || '');
  
  // Dispatch event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-log-added', { detail: entry }));
  }
}

/**
 * Get all logs
 */
export function getLogs(): LogEntry[] {
  return [...state.logs];
}

/**
 * Get logs as formatted text
 */
export function getLogsAsText(): string {
  return state.logs.map(log => {
    const dataStr = log.data ? ` ${JSON.stringify(log.data)}` : '';
    return `${log.elapsed} [${log.level.toUpperCase().padEnd(5)}] ${log.message}${dataStr}`;
  }).join('\n');
}

/**
 * Get logs as JSON
 */
export function getLogsAsJson(): string {
  return JSON.stringify({
    sessionId: state.sessionId,
    exportedAt: new Date().toISOString(),
    logs: state.logs,
  }, null, 2);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  state.logs = [];
  state.startTime = null;
  persist();
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debug-logs-cleared'));
  }
}

/**
 * Get session ID
 */
export function getSessionId(): string {
  return state.sessionId;
}

/**
 * Get error count
 */
export function getErrorCount(): number {
  return state.logs.filter(l => l.level === 'error').length;
}

/**
 * Upload logs to backend
 */
export async function uploadLogs(): Promise<{ success: boolean; error?: string }> {
  if (state.logs.length === 0) {
    return { success: false, error: 'No logs to upload' };
  }
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { error } = await supabase.functions.invoke('debug-logs', {
      body: {
        sessionId: state.sessionId,
        logs: state.logs,
      },
    });
    
    if (error) throw error;
    
    debugLog('info', 'Logs uploaded to backend');
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    debugLog('error', 'Failed to upload logs', { error: msg });
    return { success: false, error: msg };
  }
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__DEBUG_LOGS__ = {
    getLogs,
    getLogsAsText,
    getLogsAsJson,
    clearLogs,
    uploadLogs,
    debugLog,
  };
}
