import { logger } from '../logging/logger';

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure component render time
  measureRender(componentName: string, callback: () => void) {
    const start = performance.now();
    callback();
    const end = performance.now();
    this.recordMetric(`render_${componentName}`, end - start);
  }

  // Measure async operation
  async measureAsync<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const end = performance.now();
      this.recordMetric(`async_${operationName}`, end - start);
      return result;
    } catch (error) {
      const end = performance.now();
      this.recordMetric(`async_${operationName}_error`, end - start);
      throw error;
    }
  }

  // Record a metric
  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }

    // Log slow operations
    if (value > 100) {
      logger.warn('Slow operation detected: ${name} took ${value.toFixed(2)}ms');
    }
  }

  // Get performance report
  getReport() {
    const report: Record<string, any> = {};
    
    this.metrics.forEach((values, name) => {
      if (values.length === 0) return;
      
      const sorted = [...values].sort((a, b) => a - b);
      report[name] = {
        count: values.length,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });

    return report;
  }

  // Web Vitals monitoring
  static initWebVitals() {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          logger.info('FCP:', { data: entry.startTime });
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      logger.info('LCP:', { data: lastEntry.startTime });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime;
        logger.info('FID:', { data: delay });
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  }
}

// Bundle size tracking
export function trackBundleSize() {
  if (typeof window === 'undefined') return;

  // Track JavaScript resources
  const resources = performance.getEntriesByType('resource');
  const jsResources = resources.filter(r => r.name.endsWith('.js'));
  
  const totalSize = jsResources.reduce((total, resource: any) => {
    return total + (resource.transferSize || 0);
  }, 0);

  logger.info('Total JS bundle size:', { data: (totalSize / 1024 / 1024 }).toFixed(2) + 'MB');
  
  // Log individual chunks
  jsResources.forEach((resource: any) => {
    const size = (resource.transferSize || 0) / 1024;
    if (size > 100) { // Log chunks larger than 100KB
      logger.info(`${resource.name.split('/').pop()}: ${size.toFixed(2)}KB`);
    }
  });
}

// Memory usage monitoring
export function monitorMemoryUsage() {
  if (typeof window === 'undefined' || !('memory' in performance)) return;

  const logMemory = () => {
    const memory = (performance as any).memory;
    const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    
    logger.info('Memory: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)');
    
    // Warn if using more than 50% of available memory
    if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.5) {
      logger.warn('High memory usage detected!');
    }
  };

  // Log every 30 seconds
  setInterval(logMemory, 30000);
}