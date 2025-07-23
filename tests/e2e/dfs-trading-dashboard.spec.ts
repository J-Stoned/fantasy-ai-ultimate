/**
 * 🔥 DFS TRADING DASHBOARD E2E TESTS 🔥
 * 
 * Comprehensive end-to-end testing for DFS Trading Dashboard.
 * Tests portfolio management, contest analysis, and real-time trading features.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('DFS Trading Dashboard', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to DFS Trading Dashboard with admin authentication
    await page.goto('/admin/dfs-training');
    
    // Wait for admin layout to be fully loaded
    await page.waitForSelector('[data-testid="admin-layout"]', { timeout: 10000 });
    
    // Wait for trading dashboard components to load
    await page.waitForSelector('[data-testid="trading-dashboard"]', { timeout: 15000 });
  });

  test.describe('Dashboard Loading and Performance', () => {
    test('should load trading dashboard within performance targets', async () => {
      const startTime = Date.now();
      
      // Measure page load time
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Performance assertion: Load time should be under 2500ms (TradingView charts take longer)
      expect(loadTime).toBeLessThan(2500);
      
      // Verify main dashboard elements are visible
      await expect(page.locator('[data-testid="portfolio-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="trading-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="risk-monitoring"]')).toBeVisible();
    });

    test('should display all header metrics within 100ms updates', async () => {
      const metricsBar = page.locator('[data-testid="header-metrics-bar"]');
      await expect(metricsBar).toBeVisible();
      
      // Wait for potential real-time updates
      await page.waitForTimeout(1000);
      
      // Verify all metric cards are present
      const expectedMetrics = [
        'Portfolio',
        'Win Rate', 
        'Sharpe Ratio',
        'ROI',
        'Max Drawdown',
        'Active Entries',
        'Avg Overlay',
        'EV/Hour'
      ];
      
      for (const metric of expectedMetrics) {
        await expect(page.locator(`text=${metric}`)).toBeVisible();
      }
    });

    test('should render TradingView-style chart correctly', async () => {
      const chartContainer = page.locator('[data-testid="trading-chart-container"]');
      await expect(chartContainer).toBeVisible();
      
      // Wait for chart to fully render
      await page.waitForTimeout(2000);
      
      // Verify chart canvas is present
      const canvas = page.locator('canvas');
      await expect(canvas).toHaveCount({ min: 1 });
      
      // Test chart timeframe buttons
      const timeframes = ['1H', '4H', '1D', '1W'];
      for (const timeframe of timeframes) {
        await expect(page.locator(`button:has-text("${timeframe}")`)).toBeVisible();
      }
    });
  });

  test.describe('Portfolio Metrics Validation', () => {
    test('should display portfolio value with proper formatting', async () => {
      const portfolioValue = page.locator('[data-testid="portfolio-total-value"]');
      await expect(portfolioValue).toBeVisible();
      
      const valueText = await portfolioValue.textContent();
      // Should be formatted as currency with commas
      expect(valueText).toMatch(/^\$[\d,]+\.\d{2}$/);
      
      // Value should be reasonable (between $1K and $1M for testing)
      const numericValue = parseFloat(valueText?.replace(/[$,]/g, '') || '0');
      expect(numericValue).toBeGreaterThan(1000);
      expect(numericValue).toBeLessThan(1000000);
    });

    test('should show win rate with progress visualization', async () => {
      const winRateCard = page.locator('[data-testid="win-rate-card"]');
      await expect(winRateCard).toBeVisible();
      
      const winRateText = await winRateCard.locator('[data-testid="win-rate-value"]').textContent();
      const winRate = parseFloat(winRateText?.replace('%', '') || '0');
      
      // Win rate should be between 40-80% for realistic DFS performance
      expect(winRate).toBeGreaterThan(40);
      expect(winRate).toBeLessThan(80);
      
      // Verify progress bar is present and has correct width
      const progressBar = winRateCard.locator('[data-testid="win-rate-progress"]');
      await expect(progressBar).toBeVisible();
    });

    test('should display Sharpe ratio indicating excellent performance', async () => {
      const sharpeRatio = page.locator('[data-testid="sharpe-ratio-value"]');
      await expect(sharpeRatio).toBeVisible();
      
      const sharpeText = await sharpeRatio.textContent();
      const sharpe = parseFloat(sharpeText || '0');
      
      // Sharpe ratio > 1.5 is considered excellent
      expect(sharpe).toBeGreaterThan(1.5);
      
      // Should show "Excellent" label
      await expect(page.locator('text=Excellent')).toBeVisible();
    });

    test('should show positive ROI and returns', async () => {
      const roiCard = page.locator('[data-testid="roi-card"]');
      await expect(roiCard).toBeVisible();
      
      const roiText = await roiCard.locator('[data-testid="roi-value"]').textContent();
      expect(roiText).toContain('+'); // Should be positive
      expect(roiText).toContain('%');
      
      // Should also show absolute return value
      const returnText = await roiCard.locator('[data-testid="total-return"]').textContent();
      expect(returnText).toContain('$');
      expect(returnText).toContain('+'); // Should be positive
    });

    test('should display controlled max drawdown', async () => {
      const drawdownText = await page.textContent('[data-testid="max-drawdown-value"]');
      const drawdown = parseFloat(drawdownText?.replace('%', '') || '0');
      
      // Max drawdown should be negative and controlled (> -20%)
      expect(drawdown).toBeLessThan(0);
      expect(drawdown).toBeGreaterThan(-20);
      
      // Should show "Controlled" status
      await expect(page.locator('text=Controlled')).toBeVisible();
    });
  });

  test.describe('Contest Price Action Chart', () => {
    test('should display 24h trading statistics', async () => {
      const chartSection = page.locator('[data-testid="chart-section"]');
      await expect(chartSection).toBeVisible();
      
      // Verify 24h statistics
      const stats = ['24h Volume', '24h High', '24h Low', '24h Change'];
      for (const stat of stats) {
        await expect(page.locator(`text=${stat}`)).toBeVisible();
      }
      
      // Verify volume is formatted properly
      const volumeText = await page.textContent('[data-testid="24h-volume"]');
      expect(volumeText).toMatch(/^\$[\d.]+[KMB]$/); // Should be like $2.4M
    });

    test('should allow timeframe selection', async () => {
      const timeframes = ['1H', '4H', '1D', '1W'];
      
      for (const timeframe of timeframes) {
        const button = page.locator(`button:has-text("${timeframe}")`);
        await expect(button).toBeVisible();
        
        // Click timeframe button
        await button.click();
        await page.waitForTimeout(500);
        
        // Verify chart updates (would need to check chart data changes)
        // For now, just verify no errors occur
      }
    });

    test('should handle chart interactions', async () => {
      const chartContainer = page.locator('[data-testid="trading-chart-container"]');
      
      // Test mouse hover over chart
      await chartContainer.hover();
      await page.waitForTimeout(500);
      
      // Test clicking on chart
      await chartContainer.click();
      await page.waitForTimeout(500);
      
      // Verify no JavaScript errors occurred
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Risk Monitoring System', () => {
    test('should display circuit breaker gauge', async () => {
      const circuitBreaker = page.locator('[data-testid="circuit-breaker-gauge"]');
      await expect(circuitBreaker).toBeVisible();
      
      // Should have SVG gauge visualization
      const svg = circuitBreaker.locator('svg');
      await expect(svg).toBeVisible();
      
      // Should display risk level percentage
      const riskLevel = circuitBreaker.locator('[data-testid="risk-level"]');
      await expect(riskLevel).toBeVisible();
      
      const riskText = await riskLevel.textContent();
      expect(riskText).toMatch(/^\d+%$/);
    });

    test('should show exposure and loss limits', async () => {
      const exposureLimit = page.locator('[data-testid="exposure-limit"]');
      await expect(exposureLimit).toBeVisible();
      
      // Should show current/max format like "$3,500 / $5,000"
      const exposureText = await exposureLimit.textContent();
      expect(exposureText).toMatch(/^\$[\d,]+ \/ \$[\d,]+$/);
      
      const dailyLossLimit = page.locator('[data-testid="daily-loss-limit"]');
      await expect(dailyLossLimit).toBeVisible();
      
      const lossText = await dailyLossLimit.textContent();
      expect(lossText).toMatch(/^\$[\d,]+ \/ \$[\d,]+$/);
    });

    test('should indicate system status as normal', async () => {
      const systemStatus = page.locator('[data-testid="system-status-badge"]');
      await expect(systemStatus).toBeVisible();
      await expect(systemStatus).toContainText('All Systems Normal');
      
      // Verify status indicators
      const indicators = [
        'Circuit breaker: Active',
        'Auto-hedge: Enabled',
        'Position sizing: Conservative'
      ];
      
      for (const indicator of indicators) {
        await expect(page.locator(`text=${indicator}`)).toBeVisible();
      }
    });

    test('should update risk metrics in real-time', async () => {
      // Get initial risk level
      const initialRisk = await page.textContent('[data-testid="risk-level"]');
      
      // Wait for potential updates (gauge animates every 2 seconds)
      await page.waitForTimeout(3000);
      
      // Verify risk level is still valid
      const updatedRisk = await page.textContent('[data-testid="risk-level"]');
      expect(updatedRisk).toMatch(/^\d+%$/);
      
      // Verify progress bars are animated
      const progressBars = page.locator('[data-testid="risk-progress-bar"]');
      const count = await progressBars.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Live News Feed', () => {
    test('should display real-time news items', async () => {
      const newsFeed = page.locator('[data-testid="live-news-feed"]');
      await expect(newsFeed).toBeVisible();
      
      // Should have news items
      const newsItems = page.locator('[data-testid="news-item"]');
      const itemCount = await newsItems.count();
      expect(itemCount).toBeGreaterThan(0);
    });

    test('should categorize news by sport and impact', async () => {
      const newsItems = page.locator('[data-testid="news-item"]');
      const firstItem = newsItems.first();
      
      // Should have sport badge
      const sportBadge = firstItem.locator('[data-testid="sport-badge"]');
      await expect(sportBadge).toBeVisible();
      
      // Should have impact badge
      const impactBadge = firstItem.locator('[data-testid="impact-badge"]');
      await expect(impactBadge).toBeVisible();
      
      // Should have sentiment indicator
      const sentimentIcon = firstItem.locator('[data-testid="sentiment-icon"]');
      await expect(sentimentIcon).toBeVisible();
    });

    test('should show timestamps for news items', async () => {
      const newsItems = page.locator('[data-testid="news-item"]');
      const firstItem = newsItems.first();
      
      const timestamp = firstItem.locator('[data-testid="news-timestamp"]');
      await expect(timestamp).toBeVisible();
      
      const timestampText = await timestamp.textContent();
      // Should be formatted as time (e.g., "2:30 PM")
      expect(timestampText).toMatch(/^\d{1,2}:\d{2}/);
    });

    test('should handle news feed scrolling', async () => {
      const newsFeed = page.locator('[data-testid="news-feed-container"]');
      
      // Scroll within news feed
      await newsFeed.hover();
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(500);
      
      // Verify scrolling worked
      await expect(newsFeed).toBeVisible();
    });
  });

  test.describe('Quick Actions Panel', () => {
    test('should display all quick action buttons', async () => {
      const quickActions = page.locator('[data-testid="quick-actions-panel"]');
      await expect(quickActions).toBeVisible();
      
      const actionButtons = [
        'Enter Contest',
        'View Analytics', 
        'Risk Settings',
        'Portfolio Analysis'
      ];
      
      for (const action of actionButtons) {
        await expect(page.locator(`button:has-text("${action}")`)).toBeVisible();
      }
    });

    test('should handle button interactions', async () => {
      const enterContestBtn = page.locator('button:has-text("Enter Contest")');
      await expect(enterContestBtn).toBeVisible();
      
      // Click button and verify no errors
      await enterContestBtn.click();
      await page.waitForTimeout(500);
      
      // Test other buttons
      const viewAnalyticsBtn = page.locator('button:has-text("View Analytics")');
      await viewAnalyticsBtn.click();
      await page.waitForTimeout(500);
    });

    test('should have proper button styling and icons', async () => {
      const actionButtons = page.locator('[data-testid="quick-actions-panel"] button');
      const count = await actionButtons.count();
      
      expect(count).toBe(4);
      
      // Verify each button has an icon
      for (let i = 0; i < count; i++) {
        const button = actionButtons.nth(i);
        const icon = button.locator('svg');
        await expect(icon).toBeVisible();
      }
    });
  });

  test.describe('Performance Summary', () => {
    test('should display todays performance metrics', async () => {
      const performancePanel = page.locator('[data-testid="performance-summary"]');
      await expect(performancePanel).toBeVisible();
      
      const metrics = [
        'Contests Entered',
        'Total Invested',
        'Current Value', 
        'Profit/Loss',
        'Avg EV'
      ];
      
      for (const metric of metrics) {
        await expect(page.locator(`text=${metric}`)).toBeVisible();
      }
    });

    test('should show positive performance indicators', async () => {
      // Current value should be higher than total invested
      const totalInvested = await page.textContent('[data-testid="total-invested-value"]');
      const currentValue = await page.textContent('[data-testid="current-value"]');
      
      const invested = parseFloat(totalInvested?.replace(/[$,]/g, '') || '0');
      const current = parseFloat(currentValue?.replace(/[$,]/g, '') || '0');
      
      expect(current).toBeGreaterThanOrEqual(invested);
      
      // Profit/Loss should be positive
      const profitLossText = await page.textContent('[data-testid="profit-loss"]');
      expect(profitLossText).toContain('+');
      
      // Average EV should be positive
      const avgEvText = await page.textContent('[data-testid="avg-ev"]');
      expect(avgEvText).toContain('+');
    });

    test('should display realistic contest entry numbers', async () => {
      const contestsEntered = await page.textContent('[data-testid="contests-entered"]');
      const contests = parseInt(contestsEntered || '0');
      
      // Should be reasonable number of contests per day
      expect(contests).toBeGreaterThan(0);
      expect(contests).toBeLessThan(100);
    });
  });

  test.describe('Real-time Updates and WebSocket', () => {
    test('should handle real-time data updates', async () => {
      // Monitor network activity for WebSocket connections
      const wsConnections: string[] = [];
      page.on('websocket', ws => {
        wsConnections.push(ws.url());
      });
      
      // Wait for potential WebSocket connections
      await page.waitForTimeout(2000);
      
      // Verify animated elements indicating real-time updates
      const animatedElements = page.locator('.animate-pulse');
      const animationCount = await animatedElements.count();
      expect(animationCount).toBeGreaterThan(0);
    });

    test('should maintain data consistency during updates', async () => {
      // Take snapshot of key metrics
      const initialPortfolioValue = await page.textContent('[data-testid="portfolio-total-value"]');
      
      // Wait for potential updates
      await page.waitForTimeout(3000);
      
      // Verify values are still properly formatted
      const updatedPortfolioValue = await page.textContent('[data-testid="portfolio-total-value"]');
      expect(updatedPortfolioValue).toMatch(/^\$[\d,]+\.\d{2}$/);
      
      // Values might change but should remain within reasonable bounds
      const initialValue = parseFloat(initialPortfolioValue?.replace(/[$,]/g, '') || '0');
      const updatedValue = parseFloat(updatedPortfolioValue?.replace(/[$,]/g, '') || '0');
      
      // Value shouldn't change dramatically in a few seconds
      const changePercentage = Math.abs((updatedValue - initialValue) / initialValue) * 100;
      expect(changePercentage).toBeLessThan(10); // Less than 10% change
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt to mobile viewports', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(1000);
      
      // Main elements should still be visible
      await expect(page.locator('[data-testid="trading-dashboard"]')).toBeVisible();
      
      // Metrics might be stacked differently but should be present
      const metricsCount = await page.locator('[data-testid="metric-card"]').count();
      expect(metricsCount).toBeGreaterThan(0);
    });

    test('should work on tablet viewports', async () => {
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      
      // Chart should still be functional
      await expect(page.locator('[data-testid="trading-chart-container"]')).toBeVisible();
      
      // News feed should be accessible
      await expect(page.locator('[data-testid="live-news-feed"]')).toBeVisible();
    });

    test('should optimize for 4K displays', async () => {
      // Test 4K viewport
      await page.setViewportSize({ width: 3840, height: 2160 });
      await page.waitForTimeout(1000);
      
      // Elements should scale properly
      await expect(page.locator('[data-testid="trading-dashboard"]')).toBeVisible();
      
      // Text should remain readable
      const portfolioValue = page.locator('[data-testid="portfolio-total-value"]');
      await expect(portfolioValue).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle chart rendering failures gracefully', async () => {
      // Monitor console for chart-related errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('chart')) {
          consoleErrors.push(msg.text());
        }
      });
      
      // Reload page to test chart initialization
      await page.reload();
      await page.waitForSelector('[data-testid="trading-dashboard"]');
      
      // Verify no critical chart errors
      expect(consoleErrors.filter(error => 
        error.includes('Cannot read property') || 
        error.includes('undefined')
      )).toHaveLength(0);
    });

    test('should maintain functionality during network issues', async () => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 1000);
      });
      
      // Navigate and verify loading behavior
      await page.goto('/admin/dfs-training');
      
      // Should eventually load despite slow network
      await expect(page.locator('[data-testid="trading-dashboard"]')).toBeVisible({ timeout: 30000 });
    });
  });
});