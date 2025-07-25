import { use, useEffect, useCallback, useRef, startTransition } from 'react';
import { ApiResponse } from '../types/api';
import { modernFetch, FetchConfig } from '../api/modern-client';

// 2025 Best Practice: React 19 'use' hook for Suspense
export function useApi<T>(
  url: string,
  config?: FetchConfig
): T {
  // React 19 'use' hook automatically handles Suspense
  const response = use(modernFetch<T>(url, config));
  
  if (!response.success) {
    throw new Error(response.error?.message || 'API request failed');
  }
  
  return response.data!;
}

// 2025 Best Practice: Optimistic updates with React 19
export function useOptimisticApi<T, TOptimistic = T>(
  url: string,
  options?: {
    optimisticUpdate?: (current: T, update: TOptimistic) => T;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const execute = useCallback(async (
    body?: any,
    optimisticData?: TOptimistic
  ) => {
    setIsLoading(true);
    setError(null);
    
    // Optimistic update
    if (optimisticData && options?.optimisticUpdate && data) {
      startTransition(() => {
        setData(options.optimisticUpdate!(data, optimisticData));
      });
    }
    
    try {
      const response = await modernFetch<T>(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Request failed');
      }
      
      setData(response.data!);
      options?.onSuccess?.(response.data!);
      
    } catch (err) {
      setError(err as Error);
      options?.onError?.(err as Error);
      
      // Revert optimistic update
      if (optimisticData && data) {
        setData(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [url, data, options]);
  
  return { data, error, isLoading, execute };
}

// 2025 Best Practice: Real-time subscriptions with Server-Sent Events
export function useRealtimeApi<T>(
  url: string,
  options?: {
    initialData?: T;
    onMessage?: (data: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [data, setData] = React.useState<T | undefined>(options?.initialData);
  const [isConnected, setIsConnected] = React.useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  useEffect(() => {
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data) as T;
        setData(newData);
        options?.onMessage?.(newData);
      } catch (err) {
        options?.onError?.(err as Error);
      }
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
      options?.onError?.(new Error('Connection lost'));
    };
    
    return () => {
      eventSource.close();
    };
  }, [url, options]);
  
  const close = useCallback(() => {
    eventSourceRef.current?.close();
    setIsConnected(false);
  }, []);
  
  return { data, isConnected, close };
}

// 2025 Best Practice: Infinite scrolling with React 19
export function useInfiniteApi<T>(
  baseUrl: string,
  pageSize = 20
) {
  const [items, setItems] = React.useState<T[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    try {
      const response = await modernFetch<{
        items: T[];
        hasMore: boolean;
      }>(`${baseUrl}?page=${page}&pageSize=${pageSize}`);
      
      if (response.success && response.data) {
        setItems(prev => [...prev, ...response.data.items]);
        setHasMore(response.data.hasMore);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load more items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, page, pageSize, hasMore, isLoading]);
  
  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, []);
  
  return { items, loadMore, hasMore, isLoading, reset };
}

// 2025 Best Practice: Debounced search with abort controller
export function useSearch<T>(
  searchFn: (query: string) => Promise<ApiResponse<T[]>>,
  debounceMs = 300
) {
  const [results, setResults] = React.useState<T[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const search = useCallback(async (query: string) => {
    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    // Debounce
    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      try {
        const response = await searchFn(query);
        
        if (!controller.signal.aborted) {
          if (response.success && response.data) {
            setResults(response.data);
          } else {
            throw new Error(response.error?.message || 'Search failed');
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err as Error);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, debounceMs);
  }, [searchFn, debounceMs]);
  
  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);
  
  return { results, isSearching, error, search, clear };
}