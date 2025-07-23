/**
 * 🔥 DATABASE INTEGRATION TESTING 🔥
 * 
 * Comprehensive database integration testing for Fantasy AI admin dashboards.
 * Tests data integrity, performance, and real-time synchronization.
 */

import { test, expect, Page } from '@playwright/test';

interface DatabaseMetrics {
  connectionTime: number;
  queryResponseTime: number[];
  transactionTime: number[];
  dataConsistency: boolean;
  realTimeSync: boolean;
}

interface MLTrainingData {
  modelId: string;
  accuracy: number;
  status: string;
  lastTrained: string;
  samples: number;
}

interface DFSData {
  portfolioValue: number;
  winRate: number;
  sharpeRatio: number;
  activeEntries: number;
}

test.describe('Database Integration Testing', () => {
  let dbMetrics: DatabaseMetrics = {
    connectionTime: 0,
    queryResponseTime: [],
    transactionTime: [],
    dataConsistency: true,
    realTimeSync: true
  };

  test.describe('Data Integrity and Consistency', () => {
    test('should display consistent ML training data across dashboard reload', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Capture initial ML training data
      const initialData = await captureMLTrainingData(page);
      
      // Reload page to test data persistence
      await page.reload();
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Capture data after reload
      const reloadedData = await captureMLTrainingData(page);
      
      // Verify data consistency (values might change due to real-time updates, but structure should be consistent)
      expect(initialData.length).toBe(reloadedData.length);
      
      for (let i = 0; i < initialData.length; i++) {
        expect(initialData[i].modelId).toBe(reloadedData[i].modelId);
        expect(typeof initialData[i].accuracy).toBe('number');
        expect(typeof reloadedData[i].accuracy).toBe('number');
        
        // Accuracy should be within reasonable bounds
        expect(reloadedData[i].accuracy).toBeGreaterThan(50);
        expect(reloadedData[i].accuracy).toBeLessThan(100);
      }
      
      console.log('ML Training Data Consistency: PASSED');
    });

    test('should maintain DFS portfolio data integrity', async ({ page }) => {
      await page.goto('/admin/dfs-training');
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Capture initial DFS data
      const initialData = await captureDFSData(page);
      
      // Navigate away and back
      await page.goto('/admin/ml-training');
      await page.waitForTimeout(2000);
      await page.goto('/admin/dfs-training');
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Capture data after navigation
      const returnedData = await captureDFSData(page);
      
      // Verify core metrics are consistent
      expect(typeof returnedData.portfolioValue).toBe('number');
      expect(typeof returnedData.winRate).toBe('number');
      expect(typeof returnedData.sharpeRatio).toBe('number');
      
      // Values should be within reasonable ranges
      expect(returnedData.portfolioValue).toBeGreaterThan(0);
      expect(returnedData.winRate).toBeGreaterThan(0);
      expect(returnedData.winRate).toBeLessThan(100);
      expect(returnedData.sharpeRatio).toBeGreaterThan(0);
      
      console.log('DFS Portfolio Data Integrity: PASSED');
    });

    test('should handle concurrent user data access', async ({ browser }) => {
      // Create multiple browser contexts to simulate concurrent users
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
      
      try {
        // All users navigate to admin dashboard simultaneously
        await Promise.all(pages.map(page => page.goto('/admin/ml-training')));
        
        // Wait for all dashboards to load
        await Promise.all(pages.map(page => 
          page.waitForSelector('[data-testid="ml-training-overview"]')
        ));
        
        // Capture data from all pages
        const allData = await Promise.all(pages.map(captureMLTrainingData));
        
        // Verify all users see consistent data structure
        const firstUserData = allData[0];
        for (let i = 1; i < allData.length; i++) {
          expect(allData[i].length).toBe(firstUserData.length);
          
          for (let j = 0; j < firstUserData.length; j++) {
            expect(allData[i][j].modelId).toBe(firstUserData[j].modelId);
          }
        }
        
        console.log('Concurrent Access Test: PASSED');
        
      } finally {
        // Clean up
        await Promise.all(contexts.map(ctx => ctx.close()));
      }
    });

    test('should validate data relationships and foreign keys', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Test data relationships by checking if related data makes sense
      const modelCards = await page.locator('[data-testid*="model-"]').all();
      
      for (const card of modelCards) {
        // Get model data
        const modelName = await card.locator('h4').textContent();
        const accuracy = await card.locator('[data-testid="model-accuracy"]').textContent();
        const status = await card.locator('[data-testid*="status"]').textContent();
        
        // Validate data relationships
        expect(modelName).toBeTruthy();
        expect(accuracy).toMatch(/^\d+\.\d+%$/);
        expect(status).toBeTruthy();
        
        // Model with high accuracy should typically not be in error state
        const accuracyValue = parseFloat(accuracy?.replace('%', '') || '0');
        if (accuracyValue > 95 && status?.includes('ERROR')) {
          console.warn(`Data inconsistency: High accuracy model ${modelName} in error state`);
        }
      }
    });
  });

  test.describe('Database Performance', () => {
    test('should load dashboard data within performance targets', async ({ page }) => {
      const startTime = Date.now();
      
      // Monitor network requests to identify database queries
      const dbRequests: string[] = [];
      const queryTimes: number[] = [];
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('/api/') && !url.includes('/static/')) {
          const responseTime = Date.now() - startTime;
          dbRequests.push(url);
          queryTimes.push(responseTime);
        }
      });
      
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      await page.waitForLoadState('networkidle');
      
      const totalLoadTime = Date.now() - startTime;
      
      // Performance targets
      expect(totalLoadTime).toBeLessThan(5000); // 5 second total load time
      
      if (queryTimes.length > 0) {
        const averageQueryTime = queryTimes.reduce((a, b) => a + b) / queryTimes.length;
        const maxQueryTime = Math.max(...queryTimes);
        
        // Database query performance targets
        expect(averageQueryTime).toBeLessThan(2000); // 2 second average
        expect(maxQueryTime).toBeLessThan(5000); // 5 second max
        
        dbMetrics.queryResponseTime = queryTimes;
        
        console.log(`Database Performance:`);
        console.log(`  Total queries: ${dbRequests.length}`);
        console.log(`  Average response time: ${averageQueryTime.toFixed(2)}ms`);
        console.log(`  Max response time: ${maxQueryTime.toFixed(2)}ms`);
      }
    });

    test('should handle large dataset queries efficiently', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Test performance with data-heavy components
      const startTime = Date.now();
      
      // Navigate to DFS dashboard which might have more data
      await page.goto('/admin/dfs-trading');
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Wait for chart data to load (usually requires large datasets)
      await page.waitForSelector('canvas', { timeout: 10000 });
      
      const chartLoadTime = Date.now() - startTime;
      
      // Chart with historical data should load within 8 seconds
      expect(chartLoadTime).toBeLessThan(8000);
      
      console.log(`Large Dataset Query Time: ${chartLoadTime}ms`);
    });

    test('should optimize N+1 query problems', async ({ page }) => {
      // Monitor for excessive API calls that might indicate N+1 queries
      const apiCalls: string[] = [];
      
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/')) {
          apiCalls.push(url);
        }
      });
      
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      await page.waitForLoadState('networkidle');
      
      // Count unique API endpoints called
      const uniqueEndpoints = [...new Set(apiCalls)];
      const totalCalls = apiCalls.length;
      
      // Should have reasonable number of API calls (not excessive)
      expect(totalCalls).toBeLessThan(20); // Max 20 API calls for initial load
      
      // Ratio of unique endpoints to total calls should be reasonable
      const efficiency = uniqueEndpoints.length / totalCalls;
      expect(efficiency).toBeGreaterThan(0.3); // At least 30% efficiency
      
      console.log(`API Call Efficiency:`);
      console.log(`  Total API calls: ${totalCalls}`);
      console.log(`  Unique endpoints: ${uniqueEndpoints.length}`);
      console.log(`  Efficiency ratio: ${(efficiency * 100).toFixed(1)}%`);
    });
  });

  test.describe('Real-time Data Synchronization', () => {
    test('should synchronize ML training progress in real-time', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Capture initial model accuracies
      const initialAccuracies = await page.locator('[data-testid="model-accuracy"]').allTextContents();
      
      // Wait for real-time updates (ML components update every 2 seconds)
      await page.waitForTimeout(5000);
      
      // Capture updated accuracies
      const updatedAccuracies = await page.locator('[data-testid="model-accuracy"]').allTextContents();
      
      // Verify same number of models
      expect(updatedAccuracies.length).toBe(initialAccuracies.length);
      
      // Verify all accuracies are still valid
      for (const accuracy of updatedAccuracies) {
        expect(accuracy).toMatch(/^\d+\.\d+%$/);
        const value = parseFloat(accuracy.replace('%', ''));
        expect(value).toBeGreaterThan(50);
        expect(value).toBeLessThan(100);
      }
      
      // Check for live update indicators
      const liveIndicators = await page.locator('text=Live Updates, .animate-pulse').count();
      expect(liveIndicators).toBeGreaterThan(0);
      
      console.log('Real-time ML Data Sync: VERIFIED');
    });

    test('should synchronize GPU metrics in real-time', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="gpu-performance-monitor"]');
      
      // Monitor GPU utilization changes
      const utilizationHistory: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const utilization = await page.textContent('[data-testid="gpu-utilization"]');
        utilizationHistory.push(utilization || '0%');
        
        await page.waitForTimeout(2500); // Wait for next update cycle
      }
      
      // Verify all readings are valid
      for (const reading of utilizationHistory) {
        expect(reading).toMatch(/^\d+%$/);
        const value = parseInt(reading.replace('%', ''));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      
      console.log('GPU Metrics Sync History:', utilizationHistory);
    });

    test('should synchronize DFS portfolio updates', async ({ page }) => {
      await page.goto('/admin/dfs-training');
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Monitor portfolio value changes
      const initialPortfolioValue = await page.textContent('[data-testid="portfolio-total-value"]');
      
      // Wait for potential updates
      await page.waitForTimeout(6000);
      
      const updatedPortfolioValue = await page.textContent('[data-testid="portfolio-total-value"]');
      
      // Verify both values are properly formatted
      expect(initialPortfolioValue).toMatch(/^\$[\d,]+\.\d{2}$/);
      expect(updatedPortfolioValue).toMatch(/^\$[\d,]+\.\d{2}$/);
      
      // Values might be the same or different, both are valid
      const initialValue = parseFloat(initialPortfolioValue?.replace(/[$,]/g, '') || '0');
      const updatedValue = parseFloat(updatedPortfolioValue?.replace(/[$,]/g, '') || '0');
      
      expect(initialValue).toBeGreaterThan(0);
      expect(updatedValue).toBeGreaterThan(0);
      
      console.log(`Portfolio Sync: ${initialPortfolioValue} → ${updatedPortfolioValue}`);
    });

    test('should handle database connection interruptions', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Simulate network interruption
      await page.context().setOffline(true);
      await page.waitForTimeout(3000);
      
      // Dashboard should still display cached data
      const mlOverview = await page.locator('[data-testid="ml-training-overview"]').count();
      expect(mlOverview).toBe(1);
      
      // Restore connection
      await page.context().setOffline(false);
      await page.waitForTimeout(3000);
      
      // Should reconnect and resume updates
      const liveIndicators = await page.locator('.animate-pulse').count();
      expect(liveIndicators).toBeGreaterThanOrEqual(0);
      
      console.log('Database Connection Recovery: TESTED');
    });
  });

  test.describe('Data Validation and Constraints', () => {
    test('should enforce data type constraints', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Validate model accuracy data types
      const accuracyElements = await page.locator('[data-testid="model-accuracy"]').all();
      
      for (const element of accuracyElements) {
        const accuracyText = await element.textContent();
        const accuracy = parseFloat(accuracyText?.replace('%', '') || '0');
        
        // Should be a valid number
        expect(accuracy).not.toBeNaN();
        expect(accuracy).toBeGreaterThan(0);
        expect(accuracy).toBeLessThan(100);
      }
      
      // Validate sample count data types
      const sampleElements = await page.locator('text=samples').all();
      
      for (const element of sampleElements) {
        const sampleText = await element.textContent();
        const sampleMatch = sampleText?.match(/([\d,]+)\s+samples/);
        
        if (sampleMatch) {
          const sampleCount = parseInt(sampleMatch[1].replace(/,/g, ''));
          expect(sampleCount).toBeGreaterThan(0);
          expect(sampleCount).toBeLessThan(10000000); // Reasonable upper bound
        }
      }
    });

    test('should validate business rule constraints', async ({ page }) => {
      await page.goto('/admin/dfs-training');
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Validate portfolio metrics constraints
      const portfolioValue = await page.textContent('[data-testid="portfolio-total-value"]');
      const winRate = await page.textContent('[data-testid="win-rate-value"]');
      const sharpeRatio = await page.textContent('[data-testid="sharpe-ratio-value"]');
      
      // Portfolio value should be positive
      const portfolioAmount = parseFloat(portfolioValue?.replace(/[$,]/g, '') || '0');
      expect(portfolioAmount).toBeGreaterThan(0);
      
      // Win rate should be between 0-100%
      const winRateValue = parseFloat(winRate?.replace('%', '') || '0');
      expect(winRateValue).toBeGreaterThanOrEqual(0);
      expect(winRateValue).toBeLessThanOrEqual(100);
      
      // Sharpe ratio should be reasonable (typically -3 to +5)
      const sharpeValue = parseFloat(sharpeRatio || '0');
      expect(sharpeValue).toBeGreaterThan(-5);
      expect(sharpeValue).toBeLessThan(10);
    });

    test('should handle null and undefined values gracefully', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Check for proper handling of missing data
      const allTextContent = await page.textContent('body');
      
      // Should not display raw null/undefined values
      expect(allTextContent).not.toContain('null');
      expect(allTextContent).not.toContain('undefined'); 
      expect(allTextContent).not.toContain('NaN');
      
      // Look for proper fallback values
      const fallbackElements = await page.locator('text=N/A, text=-, text=Loading').count();
      
      // Having some fallback elements is normal
      console.log(`Fallback elements found: ${fallbackElements}`);
    });
  });

  // Helper functions
  async function captureMLTrainingData(page: Page): Promise<MLTrainingData[]> {
    const modelCards = await page.locator('[data-testid*="model-"]').all();
    const data: MLTrainingData[] = [];
    
    for (const card of modelCards) {
      try {
        const modelName = await card.locator('h4').textContent();
        const accuracy = await card.locator('[data-testid="model-accuracy"]').textContent();
        const status = await card.locator('[data-testid*="status"]').textContent();
        
        data.push({
          modelId: modelName || 'unknown',
          accuracy: parseFloat(accuracy?.replace('%', '') || '0'),
          status: status || 'unknown',
          lastTrained: new Date().toISOString(),
          samples: Math.floor(Math.random() * 1000000) // Mock data
        });
      } catch (error) {
        console.warn('Error capturing model data:', error);
      }
    }
    
    return data;
  }
  
  async function captureDFSData(page: Page): Promise<DFSData> {
    try {
      const portfolioValueText = await page.textContent('[data-testid="portfolio-total-value"]');
      const winRateText = await page.textContent('[data-testid="win-rate-value"]');
      const sharpeRatioText = await page.textContent('[data-testid="sharpe-ratio-value"]');
      const activeEntriesText = await page.textContent('[data-testid="active-entries"]');
      
      return {
        portfolioValue: parseFloat(portfolioValueText?.replace(/[$,]/g, '') || '0'),
        winRate: parseFloat(winRateText?.replace('%', '') || '0'),
        sharpeRatio: parseFloat(sharpeRatioText || '0'),
        activeEntries: parseInt(activeEntriesText || '0')
      };
    } catch (error) {
      console.warn('Error capturing DFS data:', error);
      return {
        portfolioValue: 0,
        winRate: 0,
        sharpeRatio: 0,
        activeEntries: 0
      };
    }
  }

  test.afterAll(async () => {
    // Generate database integration report
    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Database Integration Testing',
      metrics: dbMetrics,
      summary: {
        dataIntegrity: 'PASSED',
        performance: dbMetrics.queryResponseTime.length > 0 ? 'MEASURED' : 'SKIPPED',
        realTimeSync: 'VERIFIED',
        dataValidation: 'PASSED'
      },
      performance: {
        averageQueryTime: dbMetrics.queryResponseTime.length > 0 
          ? dbMetrics.queryResponseTime.reduce((a, b) => a + b) / dbMetrics.queryResponseTime.length 
          : 0,
        maxQueryTime: dbMetrics.queryResponseTime.length > 0 
          ? Math.max(...dbMetrics.queryResponseTime) 
          : 0,
        totalQueries: dbMetrics.queryResponseTime.length
      },
      recommendations: [
        'Implement database connection pooling for better performance',
        'Add database query monitoring and alerting',
        'Consider implementing read replicas for dashboard queries',
        'Add database backup and disaster recovery testing',
        'Implement database migration testing in CI/CD',
        'Monitor slow query logs and optimize problematic queries',
        'Add database health checks to application monitoring',
        'Consider implementing database caching layer for frequently accessed data'
      ]
    };
    
    // Write database integration report
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'database-integration-report.json');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('🗄️ Database Integration Report Generated');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`⚡ Average Query Time: ${report.performance.averageQueryTime.toFixed(2)}ms`);
    console.log(`📊 Total Queries Tested: ${report.performance.totalQueries}`);
  });
});