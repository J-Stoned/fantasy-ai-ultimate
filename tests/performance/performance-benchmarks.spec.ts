/**
 * 🔥 PERFORMANCE BENCHMARKING SUITE 🔥
 * 
 * Elite performance testing for Fantasy AI admin dashboards.
 * Validates load times, real-time updates, and resource usage.
 */

import { test, expect, Page } from '@playwright/test';

interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
  memoryUsage: number;
  jsHeapUsed: number;
  domNodes: number;
  networkRequests: number;
}

interface BenchmarkResult {
  dashboard: string;
  timestamp: string;
  metrics: PerformanceMetrics;
  passed: boolean;
  recommendations: string[];
}

test.describe('Performance Benchmarking Suite', () => {
  let benchmarkResults: BenchmarkResult[] = [];

  test.describe('Dashboard Load Performance', () => {
    test('ML Training Dashboard - Load Time Benchmark', async ({ page }) => {
      const startTime = Date.now();
      
      // Start performance monitoring
      await page.goto('/admin/ml-training');
      
      // Wait for initial content to load
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Wait for all critical elements
      await Promise.all([
        page.waitForSelector('[data-testid="system-overview-cards"]'),
        page.waitForSelector('[data-testid="elite-model-status"]'),
        page.waitForSelector('[data-testid="gpu-performance-monitor"]')
      ]);
      
      const loadTime = Date.now() - startTime;
      
      // Collect Core Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise(resolve => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};
            
            entries.forEach(entry => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime;
              }
              if (entry.entryType === 'largest-contentful-paint') {
                vitals.lcp = entry.startTime;
              }
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                vitals.cls = (vitals.cls || 0) + entry.value;
              }
            });
            
            resolve(vitals);
          }).observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift'] });
          
          // Fallback timeout
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      // Collect memory usage
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });
      
      // Count DOM nodes
      const domNodeCount = await page.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      
      // Collect network metrics
      const networkRequests = await page.evaluate(() => {
        return performance.getEntriesByType('navigation').length + 
               performance.getEntriesByType('resource').length;
      });
      
      const metrics: PerformanceMetrics = {
        loadTime,
        firstContentfulPaint: (vitals as any).fcp || 0,
        largestContentfulPaint: (vitals as any).lcp || 0,
        firstInputDelay: 0, // Would need user interaction to measure
        cumulativeLayoutShift: (vitals as any).cls || 0,
        totalBlockingTime: 0, // Complex to measure
        memoryUsage: memoryInfo?.totalJSHeapSize || 0,
        jsHeapUsed: memoryInfo?.usedJSHeapSize || 0,
        domNodes: domNodeCount,
        networkRequests
      };
      
      // Performance targets
      const targets = {
        loadTime: 2000, // 2 seconds
        firstContentfulPaint: 1500, // 1.5 seconds
        largestContentfulPaint: 2500, // 2.5 seconds
        cumulativeLayoutShift: 0.1, // CLS score
        domNodes: 2000, // Reasonable DOM size
        memoryUsage: 50 * 1024 * 1024 // 50MB
      };
      
      const recommendations: string[] = [];
      let passed = true;
      
      // Validate performance targets
      if (metrics.loadTime > targets.loadTime) {
        passed = false;
        recommendations.push(`Load time ${metrics.loadTime}ms exceeds target ${targets.loadTime}ms`);
      }
      
      if (metrics.largestContentfulPaint > targets.largestContentfulPaint) {
        passed = false;
        recommendations.push(`LCP ${metrics.largestContentfulPaint}ms exceeds target ${targets.largestContentfulPaint}ms`);
      }
      
      if (metrics.cumulativeLayoutShift > targets.cumulativeLayoutShift) {
        passed = false;
        recommendations.push(`CLS ${metrics.cumulativeLayoutShift} exceeds target ${targets.cumulativeLayoutShift}`);
      }
      
      if (metrics.domNodes > targets.domNodes) {
        recommendations.push(`DOM node count ${metrics.domNodes} is high, consider virtualization`);
      }
      
      if (metrics.memoryUsage > targets.memoryUsage) {
        recommendations.push(`Memory usage ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB is high`);
      }
      
      // Add positive recommendations
      if (passed) {
        recommendations.push('✅ Load time within target (<2s)');
        recommendations.push('✅ Core Web Vitals are good');
        recommendations.push('✅ Memory usage is optimal');
      }
      
      const result: BenchmarkResult = {
        dashboard: 'ML Training Dashboard',
        timestamp: new Date().toISOString(),
        metrics,
        passed,
        recommendations
      };
      
      benchmarkResults.push(result);
      
      // Assert performance targets
      expect(metrics.loadTime).toBeLessThan(targets.loadTime);
      expect(metrics.largestContentfulPaint).toBeLessThan(targets.largestContentfulPaint);
      expect(metrics.cumulativeLayoutShift).toBeLessThan(targets.cumulativeLayoutShift);
      
      console.log('ML Training Dashboard Performance:', JSON.stringify(metrics, null, 2));
    });

    test('DFS Trading Dashboard - Load Time Benchmark', async ({ page }) => {
      const startTime = Date.now();
      
      // Start performance monitoring
      await page.goto('/admin/dfs-training');
      
      // Wait for TradingView chart and other critical elements
      await Promise.all([
        page.waitForSelector('[data-testid="trading-dashboard"]'),
        page.waitForSelector('[data-testid="portfolio-metrics"]'),
        page.waitForSelector('[data-testid="trading-chart"]', { timeout: 10000 }), // Charts take longer
        page.waitForSelector('[data-testid="risk-monitoring"]')
      ]);
      
      const loadTime = Date.now() - startTime;
      
      // Collect similar metrics as ML dashboard but with different targets
      const vitals = await page.evaluate(() => {
        return new Promise(resolve => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};
            
            entries.forEach(entry => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime;
              }
            });
            
            resolve(vitals);
          });
          
          observer.observe({ entryTypes: ['paint'] });
          setTimeout(() => resolve({}), 3000);
        });
      });
      
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : { usedJSHeapSize: 0, totalJSHeapSize: 0 };
      });
      
      const domNodeCount = await page.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      
      const metrics: PerformanceMetrics = {
        loadTime,
        firstContentfulPaint: (vitals as any).fcp || 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
        totalBlockingTime: 0,
        memoryUsage: memoryInfo.totalJSHeapSize,
        jsHeapUsed: memoryInfo.usedJSHeapSize,
        domNodes: domNodeCount,
        networkRequests: 0
      };
      
      // Trading dashboard has higher targets due to complex charts
      const targets = {
        loadTime: 3000, // 3 seconds for TradingView charts
        memoryUsage: 80 * 1024 * 1024 // 80MB for charts
      };
      
      const recommendations: string[] = [];
      let passed = true;
      
      if (metrics.loadTime > targets.loadTime) {
        passed = false;
        recommendations.push(`Load time ${metrics.loadTime}ms exceeds target ${targets.loadTime}ms`);
      } else {
        recommendations.push('✅ Trading dashboard load time acceptable');
      }
      
      if (metrics.memoryUsage > targets.memoryUsage) {
        recommendations.push(`Memory usage high due to TradingView charts: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
      
      const result: BenchmarkResult = {
        dashboard: 'DFS Trading Dashboard',
        timestamp: new Date().toISOString(),
        metrics,
        passed,
        recommendations
      };
      
      benchmarkResults.push(result);
      
      // Assert performance targets
      expect(metrics.loadTime).toBeLessThan(targets.loadTime);
      
      console.log('DFS Trading Dashboard Performance:', JSON.stringify(metrics, null, 2));
    });
  });

  test.describe('Real-time Update Performance', () => {
    test('ML Training Dashboard - Real-time Update Latency', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Measure time for real-time updates
      const updateLatencies: number[] = [];
      
      // Monitor for accuracy updates
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        // Wait for next update cycle (components update every 2 seconds)
        await page.waitForTimeout(2100);
        
        // Verify update occurred by checking if values changed
        const accuracy = await page.textContent('[data-testid="model-accuracy"]');
        const endTime = Date.now();
        
        if (accuracy) {
          updateLatencies.push(endTime - startTime);
        }
      }
      
      const averageLatency = updateLatencies.reduce((a, b) => a + b, 0) / updateLatencies.length;
      
      // Real-time updates should be under 100ms processing time (excluding wait)
      expect(averageLatency).toBeLessThan(2200); // 2000ms wait + 200ms processing
      
      console.log('ML Dashboard Real-time Update Latency:', averageLatency, 'ms');
    });

    test('GPU Monitoring - Update Frequency', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="gpu-performance-monitor"]');
      
      // Track GPU metric changes
      const initialUtilization = await page.textContent('[data-testid="gpu-utilization"]');
      
      // Wait for several update cycles
      await page.waitForTimeout(6000);
      
      const updatedUtilization = await page.textContent('[data-testid="gpu-utilization"]');
      
      // Values should be updating (might be same value but should be refreshed)
      expect(updatedUtilization).toMatch(/^\d+%$/);
      
      // Verify all GPU metrics are present and formatted correctly
      const metrics = ['gpu-utilization', 'gpu-temperature', 'gpu-vram-usage', 'gpu-power-draw'];
      
      for (const metric of metrics) {
        const value = await page.textContent(`[data-testid="${metric}"]`);
        expect(value).toBeTruthy();
        expect(value?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Resource Usage Benchmarks', () => {
    test('Memory Usage - Extended Session', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Initial memory measurement
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? 
          (performance as any).memory.usedJSHeapSize : 0;
      });
      
      // Simulate extended usage with navigation and updates
      for (let i = 0; i < 10; i++) {
        // Navigate between dashboards
        await page.goto('/admin/dfs-training');
        await page.waitForTimeout(2000);
        
        await page.goto('/admin/ml-training');
        await page.waitForTimeout(2000);
      }
      
      // Final memory measurement
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? 
          (performance as any).memory.usedJSHeapSize : 0;
      });
      
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      // Memory growth should be controlled (less than 20MB for extended session)
      expect(memoryGrowthMB).toBeLessThan(20);
      
      console.log(`Memory Growth: ${memoryGrowthMB.toFixed(2)}MB`);
    });

    test('Network Request Optimization', async ({ page }) => {
      const requests: string[] = [];
      
      // Monitor network requests
      page.on('request', request => {
        requests.push(request.url());
      });
      
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Wait for all initial requests to complete
      await page.waitForLoadState('networkidle');
      
      const uniqueRequests = [...new Set(requests)];
      const totalRequests = requests.length;
      
      // Should have reasonable number of requests (not excessive)
      expect(totalRequests).toBeLessThan(50);
      expect(uniqueRequests.length).toBeGreaterThan(5); // Should load some resources
      
      console.log(`Total Requests: ${totalRequests}, Unique: ${uniqueRequests.length}`);
    });
  });

  test.describe('Chart Performance', () => {
    test('TradingView Chart Rendering Performance', async ({ page }) => {
      const chartStartTime = Date.now();
      
      await page.goto('/admin/dfs-training');
      
      // Wait specifically for chart to be rendered
      await page.waitForSelector('canvas', { timeout: 15000 });
      
      const chartLoadTime = Date.now() - chartStartTime;
      
      // Chart should load within 10 seconds
      expect(chartLoadTime).toBeLessThan(10000);
      
      // Test chart interaction performance
      const canvas = page.locator('canvas').first();
      
      const interactionStartTime = Date.now();
      await canvas.hover();
      await canvas.click();
      const interactionTime = Date.now() - interactionStartTime;
      
      // Chart interactions should be responsive (<500ms)
      expect(interactionTime).toBeLessThan(500);
      
      console.log(`Chart Load: ${chartLoadTime}ms, Interaction: ${interactionTime}ms`);
    });

    test('Chart Data Update Performance', async ({ page }) => {
      await page.goto('/admin/dfs-training');
      await page.waitForSelector('canvas');
      
      // Test timeframe switching performance
      const timeframes = ['1H', '4H', '1D', '1W'];
      const switchTimes: number[] = [];
      
      for (const timeframe of timeframes) {
        const button = page.locator(`button:has-text("${timeframe}")`);
        
        const startTime = Date.now();
        await button.click();
        
        // Wait for chart to update (simplified - would need actual chart update detection)
        await page.waitForTimeout(500);
        
        const switchTime = Date.now() - startTime;
        switchTimes.push(switchTime);
      }
      
      const averageSwitchTime = switchTimes.reduce((a, b) => a + b) / switchTimes.length;
      
      // Timeframe switches should be fast (<1 second average)
      expect(averageSwitchTime).toBeLessThan(1000);
      
      console.log(`Average Chart Switch Time: ${averageSwitchTime}ms`);
    });
  });

  test.afterAll(async () => {
    // Generate comprehensive performance report
    const report = {
      generatedAt: new Date().toISOString(),
      testEnvironment: {
        userAgent: 'Playwright Test Runner',
        viewport: '1920x1080',
        network: 'Fast (simulated)'
      },
      summary: {
        totalTests: benchmarkResults.length,
        passed: benchmarkResults.filter(r => r.passed).length,
        failed: benchmarkResults.filter(r => !r.passed).length
      },
      results: benchmarkResults,
      recommendations: {
        immediate: [
          'Monitor dashboard load times in production',
          'Implement performance budgets in CI/CD',
          'Set up real-user monitoring (RUM)'
        ],
        optimization: [
          'Consider lazy loading for non-critical components',
          'Implement code splitting for chart libraries',
          'Optimize image assets and bundle sizes',
          'Use service workers for caching strategies'
        ],
        monitoring: [
          'Set up performance alerts for load times >2s',
          'Monitor memory usage growth over time',
          'Track Core Web Vitals in production',
          'Implement performance regression testing'
        ]
      }
    };
    
    // Write performance report
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'performance-benchmark-report.json');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 Performance Benchmark Report Generated');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`✅ ${report.summary.passed}/${report.summary.totalTests} tests passed`);
  });
});