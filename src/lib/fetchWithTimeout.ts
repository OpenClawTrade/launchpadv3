/**
 * Fetch with timeout and AbortController support.
 * Prevents infinite loading states by failing fast.
 */

const DEFAULT_TIMEOUT_MS = 8000;

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Wrapper around fetch that adds timeout support.
 * Will abort the request after timeoutMs milliseconds.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON with timeout. Returns parsed JSON or throws on error/timeout.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Create a promise that rejects after a timeout.
 * Useful for racing with other promises.
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(`Timed out after ${ms}ms`)), ms);
  });
}

/**
 * Race a promise against a timeout. Returns the promise result or throws TimeoutError.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([promise, createTimeout(ms)]);
}

// LocalStorage cache helpers for offline-first UX
const CACHE_PREFIX = "tuna_cache_";

export function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    // Cache expires after 1 hour
    if (Date.now() - timestamp > 60 * 60 * 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Ignore quota errors
  }
}
