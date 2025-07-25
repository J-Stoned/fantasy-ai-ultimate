import { ApiResponse, ApiError } from '../types/api';

// 2025 Best Practice: Modern fetch wrapper with React 19 Suspense support
export interface FetchConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

// 2025 Best Practice: Type-safe error handling
export class NetworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// 2025 Best Practice: Modern async generator for streaming responses
async function* streamResponse<T>(response: Response): AsyncGenerator<T> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) throw new NetworkError('No response body', 'NO_BODY');
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          yield JSON.parse(line) as T;
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 2025 Best Practice: React 19 cache function for data fetching
export const createCachedFetch = <T extends (...args: any[]) => Promise<any>>(
  fetcher: T,
  options?: { revalidate?: number; tags?: string[] }
) => {
  const cache = new Map<string, { data: any; timestamp: number }>();
  
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && options?.revalidate) {
      const age = Date.now() - cached.timestamp;
      if (age < options.revalidate * 1000) {
        return cached.data;
      }
    }
    
    const data = await fetcher(...args);
    cache.set(key, { data, timestamp: Date.now() });
    
    return data;
  }) as T;
};

// 2025 Best Practice: Modern fetch with all the bells and whistles
export async function modernFetch<T = unknown>(
  url: string,
  config?: FetchConfig
): Promise<ApiResponse<T>> {
  const {
    timeout = 30000,
    retries = 3,
    onUploadProgress,
    onDownloadProgress,
    ...fetchConfig
  } = config || {};
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
        // 2025: Priority hints for resource loading
        // @ts-ignore - Priority hints are new
        priority: 'high',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          `HTTP_${response.status}`,
          { status: response.status, statusText: response.statusText }
        );
      }
      
      // Handle streaming responses
      if (response.headers.get('content-type')?.includes('stream')) {
        const stream = streamResponse<T>(response);
        return { success: true, data: stream as any };
      }
      
      const data = await response.json();
      return { success: true, data };
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors
      if (error instanceof NetworkError && error.code.startsWith('HTTP_4')) {
        break;
      }
      
      // Exponential backoff
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  return {
    success: false,
    error: {
      code: lastError instanceof NetworkError ? lastError.code : 'NETWORK_ERROR',
      message: lastError?.message || 'Unknown error',
      details: lastError
    }
  };
}

// 2025 Best Practice: React Server Components compatible
export function createServerFetch(baseUrl: string) {
  return async function serverFetch<T = unknown>(
    endpoint: string,
    config?: FetchConfig
  ): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${endpoint}`;
    
    // Server-side fetch with Next.js 15 caching
    return modernFetch<T>(url, {
      ...config,
      // @ts-ignore - Next.js specific
      next: {
        revalidate: config?.cache === 'no-store' ? 0 : 3600,
        tags: config?.headers?.['x-cache-tags']?.split(',') || []
      }
    });
  };
}

// 2025 Best Practice: Type-safe API routes
export function createTypedApi<TRoutes extends Record<string, any>>(
  baseUrl: string
) {
  return new Proxy({} as TRoutes, {
    get(_, endpoint: string) {
      return {
        get: <T = unknown>(params?: Record<string, any>, config?: FetchConfig) => {
          const query = params ? `?${new URLSearchParams(params).toString()}` : '';
          return modernFetch<T>(`${baseUrl}/${endpoint}${query}`, {
            ...config,
            method: 'GET'
          });
        },
        post: <T = unknown>(body?: any, config?: FetchConfig) => {
          return modernFetch<T>(`${baseUrl}/${endpoint}`, {
            ...config,
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
              'Content-Type': 'application/json',
              ...config?.headers
            }
          });
        },
        put: <T = unknown>(body?: any, config?: FetchConfig) => {
          return modernFetch<T>(`${baseUrl}/${endpoint}`, {
            ...config,
            method: 'PUT',
            body: JSON.stringify(body),
            headers: {
              'Content-Type': 'application/json',
              ...config?.headers
            }
          });
        },
        delete: <T = unknown>(config?: FetchConfig) => {
          return modernFetch<T>(`${baseUrl}/${endpoint}`, {
            ...config,
            method: 'DELETE'
          });
        },
        stream: <T = unknown>(config?: FetchConfig) => {
          return modernFetch<T>(`${baseUrl}/${endpoint}`, {
            ...config,
            headers: {
              'Accept': 'text/event-stream',
              ...config?.headers
            }
          });
        }
      };
    }
  });
}