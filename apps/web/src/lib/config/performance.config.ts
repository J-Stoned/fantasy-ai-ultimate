/**
 * Performance configuration and optimization settings
 */

export const PERFORMANCE_CONFIG = {
  // Rendering targets
  targets: {
    renderTime: 16, // 60fps target
    scriptLoadTime: 1000, // 1 second
    interactionDelay: 100, // 100ms
    firstContentfulPaint: 1800, // 1.8 seconds
    timeToInteractive: 3800, // 3.8 seconds
  },

  // Virtual scrolling
  virtualScrolling: {
    itemHeight: 180, // Default item height for virtual lists
    overscan: 3, // Number of items to render outside viewport
    scrollDebounce: 50, // Debounce scroll events
  },

  // Image optimization
  images: {
    lazyLoadOffset: '50px', // Start loading 50px before viewport
    placeholderQuality: 10, // Low quality placeholder
    formats: ['webp', 'avif', 'jpeg'],
    sizes: {
      thumbnail: 150,
      small: 300,
      medium: 600,
      large: 1200,
    },
  },

  // Code splitting
  bundleSplitting: {
    maxBundleSize: 244, // 244KB gzipped
    prefetchDelay: 2000, // Start prefetching after 2 seconds
    chunkNames: {
      vendor: 'vendor',
      common: 'common',
      react: 'react-vendor',
      charts: 'charts-vendor',
    },
  },

  // State management
  stateOptimization: {
    batchingDelay: 0, // React 18 automatic batching
    debouncedInputDelay: 300, // Input debouncing
    throttledScrollDelay: 150, // Scroll throttling
  },

  // Memoization
  memoization: {
    maxCacheSize: 100, // Maximum memoized results
    ttl: 300000, // 5 minutes cache TTL
    complexityThreshold: 1000, // Complexity score to trigger memoization
  },

  // API optimization
  api: {
    cacheTime: 300000, // 5 minutes
    staleTime: 60000, // 1 minute
    retryDelay: 1000, // 1 second
    maxRetries: 3,
    batchDelay: 10, // Batch API calls within 10ms
  },

  // WebSocket optimization
  websocket: {
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    pingInterval: 30000, // 30 seconds
    messageQueueSize: 100,
  },

  // Component-specific settings
  components: {
    draftBoard: {
      maxVisiblePlayers: 30,
      searchDebounce: 300,
      updateBatchSize: 10,
    },
    tradingDashboard: {
      chartUpdateInterval: 1000,
      maxDataPoints: 100,
      animationDuration: 300,
    },
    leagueWizard: {
      validationDebounce: 500,
      templateCacheTime: 600000, // 10 minutes
    },
    mlPredictions: {
      maxConcurrentPredictions: 3,
      predictionCacheTime: 300000, // 5 minutes
      visualizationThrottle: 100,
    },
  },

  // Performance monitoring
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    sampleRate: 0.1, // Sample 10% of sessions
    slowRenderThreshold: 50, // Log renders over 50ms
    memoryWarningThreshold: 100, // 100MB
  },

  // Optimization features
  features: {
    enableVirtualScrolling: true,
    enableLazyLoading: true,
    enableCodeSplitting: true,
    enableServiceWorker: true,
    enablePrefetching: true,
    enableImageOptimization: true,
    enableBundleAnalyzer: process.env.ANALYZE === 'true',
  },
};

/**
 * Get component-specific performance config
 */
export function getComponentConfig(componentName: keyof typeof PERFORMANCE_CONFIG.components) {
  return PERFORMANCE_CONFIG.components[componentName] || {};
}

/**
 * Check if a render time is within acceptable limits
 */
export function isAcceptableRenderTime(renderTime: number): boolean {
  return renderTime <= PERFORMANCE_CONFIG.targets.renderTime;
}

/**
 * Get optimization suggestions based on metrics
 */
export function getOptimizationSuggestions(metrics: {
  renderTime?: number;
  componentName?: string;
  memoryUsage?: number;
  bundleSize?: number;
}): string[] {
  const suggestions: string[] = [];

  if (metrics.renderTime && metrics.renderTime > PERFORMANCE_CONFIG.targets.renderTime) {
    suggestions.push(
      `Component renders in ${metrics.renderTime.toFixed(1)}ms (target: <${PERFORMANCE_CONFIG.targets.renderTime}ms)`,
      'Consider using React.memo() or useMemo() for expensive computations',
      'Check for unnecessary re-renders with useWhyDidYouUpdate hook'
    );
  }

  if (metrics.memoryUsage && metrics.memoryUsage > PERFORMANCE_CONFIG.monitoring.memoryWarningThreshold) {
    suggestions.push(
      'High memory usage detected',
      'Consider implementing virtual scrolling for large lists',
      'Check for memory leaks in useEffect cleanup'
    );
  }

  if (metrics.bundleSize && metrics.bundleSize > PERFORMANCE_CONFIG.bundleSplitting.maxBundleSize) {
    suggestions.push(
      'Bundle size exceeds recommended limit',
      'Consider code splitting with dynamic imports',
      'Analyze bundle with webpack-bundle-analyzer'
    );
  }

  return suggestions;
}

/**
 * Performance optimization presets
 */
export const OPTIMIZATION_PRESETS = {
  mobile: {
    ...PERFORMANCE_CONFIG,
    targets: {
      ...PERFORMANCE_CONFIG.targets,
      renderTime: 33, // 30fps on mobile
      firstContentfulPaint: 3000,
    },
    virtualScrolling: {
      ...PERFORMANCE_CONFIG.virtualScrolling,
      overscan: 2, // Less overscan on mobile
    },
  },
  lowEnd: {
    ...PERFORMANCE_CONFIG,
    targets: {
      ...PERFORMANCE_CONFIG.targets,
      renderTime: 50, // 20fps on low-end devices
    },
    features: {
      ...PERFORMANCE_CONFIG.features,
      enableVirtualScrolling: true,
      enableLazyLoading: true,
      enablePrefetching: false, // Disable prefetching on low-end
    },
  },
  highPerformance: {
    ...PERFORMANCE_CONFIG,
    targets: {
      ...PERFORMANCE_CONFIG.targets,
      renderTime: 8, // 120fps target
      interactionDelay: 50,
    },
    virtualScrolling: {
      ...PERFORMANCE_CONFIG.virtualScrolling,
      overscan: 5, // More aggressive pre-rendering
    },
  },
};

export default PERFORMANCE_CONFIG;