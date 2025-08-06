/**
 * Performance utilities for React rendering optimization
 * Target: <16ms render times for 60fps performance
 */

import { useRef, useEffect, useCallback } from 'react';

export interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  renderCount: number;
  timestamp: number;
  props?: Record<string, any>;
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const renderStartTime = useRef<number>(0);
  
  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current++;
    
    // Measure after paint
    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStartTime.current;
      
      if (renderTime > 16) {
        console.warn(
          `[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms (target: <16ms)`
        );
      }
      
      // Log to performance observer
      if (window.PerformanceObserver) {
        performance.mark(`${componentName}-render-end`);
        performance.measure(
          `${componentName}-render`,
          `${componentName}-render-start`,
          `${componentName}-render-end`
        );
      }
    });
    
    // Mark render start
    performance.mark(`${componentName}-render-start`);
  });
  
  return {
    renderCount: renderCount.current,
    measureRender: () => performance.now() - renderStartTime.current
  };
}

/**
 * Deep comparison function for React.memo
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (typeof obj1 !== 'object' || obj1 === null || 
      typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

/**
 * Shallow comparison with specific keys
 */
export function shallowEqualKeys<T extends Record<string, any>>(
  keys: (keyof T)[]
): (prevProps: T, nextProps: T) => boolean {
  return (prevProps: T, nextProps: T) => {
    return keys.every(key => prevProps[key] === nextProps[key]);
  };
}

/**
 * Debounced callback hook with performance tracking
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        const start = performance.now();
        callbackRef.current(...args);
        const duration = performance.now() - start;
        
        if (duration > 16) {
          console.warn(
            `[Performance] Debounced callback for ${callback.name} took ${duration.toFixed(2)}ms`
          );
        }
      }, delay);
    },
    [delay, ...deps]
  ) as T;
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
}

/**
 * Memoized selector for complex computations
 */
export function createSelector<T, R>(
  selector: (input: T) => R,
  equalityFn: (a: R, b: R) => boolean = Object.is
): (input: T) => R {
  let lastInput: T | undefined;
  let lastResult: R | undefined;
  let lastComputeTime = 0;
  
  return (input: T): R => {
    if (lastInput !== undefined && input === lastInput) {
      return lastResult!;
    }
    
    const start = performance.now();
    const result = selector(input);
    lastComputeTime = performance.now() - start;
    
    if (lastComputeTime > 5) {
      console.warn(
        `[Performance] Selector for ${selector.name} took ${lastComputeTime.toFixed(2)}ms`
      );
    }
    
    lastInput = input;
    lastResult = result;
    
    return result;
  };
}

/**
 * Batch state updates for better performance
 */
export function batchUpdates<T>(
  updates: Array<() => void>
): void {
  if ('startTransition' in React) {
    // Use React 18's automatic batching
    updates.forEach(update => update());
  } else {
    // Fallback for older React versions
    Promise.resolve().then(() => {
      updates.forEach(update => update());
    });
  }
}

/**
 * Virtual list hook for rendering large lists efficiently
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / itemHeight) - overscan
  );
  
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  };
}

/**
 * Performance observer setup
 */
export function setupPerformanceObserver(
  callback: (metrics: PerformanceMetrics[]) => void
) {
  if (!window.PerformanceObserver) return;
  
  const observer = new PerformanceObserver((list) => {
    const metrics: PerformanceMetrics[] = [];
    
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure' && entry.name.includes('-render')) {
        const componentName = entry.name.replace('-render', '');
        metrics.push({
          componentName,
          renderTime: entry.duration,
          renderCount: 1,
          timestamp: entry.startTime
        });
      }
    }
    
    if (metrics.length > 0) {
      callback(metrics);
    }
  });
  
  observer.observe({ entryTypes: ['measure'] });
  
  return () => observer.disconnect();
}

/**
 * React DevTools Profiler integration
 */
export function profileComponent(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  const metrics: PerformanceMetrics = {
    componentName: id,
    renderTime: actualDuration,
    renderCount: 1,
    timestamp: startTime
  };
  
  if (actualDuration > 16) {
    console.warn(
      `[Performance] Profiled component ${id} took ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`
    );
  }
  
  // Send to analytics or monitoring service
  if (window.gtag) {
    window.gtag('event', 'timing_complete', {
      name: `${id}_${phase}`,
      value: Math.round(actualDuration),
      event_category: 'React Performance'
    });
  }
}

/**
 * Lazy loading with performance tracking
 */
export function lazyWithPreload<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> & { preload: () => Promise<void> } {
  let preloadedModule: { default: T } | null = null;
  
  const LazyComponent = React.lazy(async () => {
    if (preloadedModule) {
      return preloadedModule;
    }
    
    const start = performance.now();
    const module = await importFn();
    const loadTime = performance.now() - start;
    
    if (loadTime > 1000) {
      console.warn(
        `[Performance] Lazy loading for ${importFn.name} took ${loadTime.toFixed(2)}ms`
      );
    }
    
    preloadedModule = module;
    return module;
  });
  
  (LazyComponent as any).preload = async () => {
    if (!preloadedModule) {
      preloadedModule = await importFn();
    }
  };
  
  return LazyComponent as React.LazyExoticComponent<T> & { preload: () => Promise<void> };
}

// TypeScript declarations
declare global {
  interface Window {
    PerformanceObserver?: typeof PerformanceObserver;
    gtag?: (...args: any[]) => void;
  }
}

import React, { useState } from 'react';