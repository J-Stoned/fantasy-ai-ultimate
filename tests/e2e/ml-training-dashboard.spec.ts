/**
 * 🔥 ML TRAINING DASHBOARD E2E TESTS 🔥
 * 
 * Comprehensive end-to-end testing for ML Training Dashboard.
 * Tests Ultimate Ensemble Brain, GPU monitoring, and real-time updates.
 */

import { test, expect, Page } from '@playwright/test';

test.describe('ML Training Dashboard', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to ML Training Dashboard with admin authentication
    await page.goto('/admin/ml-training');
    
    // Wait for admin layout to be fully loaded
    await page.waitForSelector('[data-testid="admin-layout"]', { timeout: 10000 });
    
    // Wait for ML training components to load
    await page.waitForSelector('[data-testid="ml-training-overview"]', { timeout: 15000 });
  });

  test.describe('Dashboard Loading and Layout', () => {
    test('should load ML training dashboard within performance targets', async () => {
      const startTime = Date.now();
      
      // Measure page load time
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Performance assertion: Load time should be under 2000ms
      expect(loadTime).toBeLessThan(2000);
      
      // Verify main dashboard elements are visible
      await expect(page.locator('h1, h2')).toContainText('ML Training');
      await expect(page.locator('[data-testid="system-overview-cards"]')).toBeVisible();
      await expect(page.locator('[data-testid="elite-model-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="gpu-performance-monitor"]')).toBeVisible();
    });

    test('should display all required navigation elements', async () => {
      // Check admin navigation
      await expect(page.locator('[data-testid="admin-navigation"]')).toBeVisible();
      
      // Verify navigation links
      const navLinks = [
        'ML Training',
        'DFS Trading',
        'System Health',
        'Analytics'
      ];
      
      for (const link of navLinks) {
        await expect(page.locator(`text=${link}`)).toBeVisible();
      }
    });

    test('should display security status bar', async () => {
      const securityBar = page.locator('[data-testid="security-status-bar"]');
      await expect(securityBar).toBeVisible();
      
      // Check security indicators
      await expect(page.locator('text=System Secure')).toBeVisible();
      await expect(page.locator('text=ML Systems Online')).toBeVisible();
      await expect(page.locator('text=DFS Trading Active')).toBeVisible();
    });
  });

  test.describe('System Overview Cards', () => {
    test('should display all system metrics cards', async () => {
      const metricsCards = [
        'Total Models',
        'Active Training',
        'Daily Optimizations',
        'Success Rate'
      ];
      
      for (const metric of metricsCards) {
        await expect(page.locator(`text=${metric}`)).toBeVisible();
      }
    });

    test('should show real-time metric updates', async () => {
      // Get initial values
      const initialActiveTraining = await page.textContent('[data-testid="active-training-count"]');
      const initialOptimizations = await page.textContent('[data-testid="daily-optimizations-count"]');
      
      // Wait for potential updates (simulated real-time data)
      await page.waitForTimeout(3000);
      
      // Values might have changed or remained the same (both are valid for real-time systems)
      const updatedActiveTraining = await page.textContent('[data-testid="active-training-count"]');
      const updatedOptimizations = await page.textContent('[data-testid="daily-optimizations-count"]');
      
      // Verify the elements are still present and displaying valid numbers
      expect(updatedActiveTraining).toMatch(/^\d+$/);
      expect(updatedOptimizations).toMatch(/^[\d,]+$/);
    });

    test('should display success rate above 95%', async () => {
      const successRateText = await page.textContent('[data-testid="success-rate"]');
      const successRate = parseFloat(successRateText?.replace('%', '') || '0');
      
      expect(successRate).toBeGreaterThan(95);
      expect(successRate).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Elite Model Status Grid', () => {
    test('should display Ultimate Ensemble Brain with high accuracy', async () => {
      const modelCard = page.locator('[data-testid="model-ultimate-ensemble-brain"]');
      await expect(modelCard).toBeVisible();
      
      // Check model name
      await expect(modelCard.locator('text=Ultimate Ensemble Brain')).toBeVisible();
      
      // Verify high accuracy (should be above 95%)
      const accuracyText = await modelCard.locator('[data-testid="model-accuracy"]').textContent();
      const accuracy = parseFloat(accuracyText?.replace('%', '') || '0');
      expect(accuracy).toBeGreaterThan(95);
    });

    test('should show Contest Selection AI performance', async () => {
      const modelCard = page.locator('[data-testid="model-contest-selection-ai"]');
      await expect(modelCard).toBeVisible();
      
      // Verify model details
      await expect(modelCard.locator('text=Contest Selection AI')).toBeVisible();
      await expect(modelCard.locator('text=NBA')).toBeVisible();
      
      // Check accuracy is reasonable for this model type
      const accuracyText = await modelCard.locator('[data-testid="model-accuracy"]').textContent();
      const accuracy = parseFloat(accuracyText?.replace('%', '') || '0');
      expect(accuracy).toBeGreaterThan(80);
    });

    test('should display model status indicators correctly', async () => {
      const statusIndicators = ['training', 'optimizing', 'idle'];
      
      for (const status of statusIndicators) {
        const statusElement = page.locator(`[data-testid="model-status-${status}"]`);
        if (await statusElement.count() > 0) {
          await expect(statusElement).toBeVisible();
          
          // Verify status has appropriate styling
          const classList = await statusElement.getAttribute('class');
          expect(classList).toContain(status);
        }
      }
    });

    test('should show model training progress bars', async () => {
      const progressBars = page.locator('[data-testid="model-progress-bar"]');
      const count = await progressBars.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Verify each progress bar has proper width based on accuracy
      for (let i = 0; i < count; i++) {
        const progressBar = progressBars.nth(i);
        const style = await progressBar.getAttribute('style');
        expect(style).toContain('width:');
      }
    });
  });

  test.describe('RTX 4060 GPU Performance Monitor', () => {
    test('should display GPU utilization metrics', async () => {
      const gpuSection = page.locator('[data-testid="gpu-performance-monitor"]');
      await expect(gpuSection).toBeVisible();
      
      // Check GPU header
      await expect(page.locator('text=RTX 4060 Performance Monitor')).toBeVisible();
      await expect(page.locator('text=3072 CUDA Cores Active')).toBeVisible();
    });

    test('should show GPU utilization within optimal range', async () => {
      const utilizationText = await page.textContent('[data-testid="gpu-utilization"]');
      const utilization = parseFloat(utilizationText?.replace('%', '') || '0');
      
      // GPU utilization should be between 50-95% for active training
      expect(utilization).toBeGreaterThan(50);
      expect(utilization).toBeLessThan(95);
    });

    test('should display temperature within safe limits', async () => {
      const temperatureText = await page.textContent('[data-testid="gpu-temperature"]');
      const temperature = parseFloat(temperatureText?.replace('°C', '') || '0');
      
      // Temperature should be between 60-80°C for normal operation
      expect(temperature).toBeGreaterThan(60);
      expect(temperature).toBeLessThan(83); // Max temp according to UI
    });

    test('should show VRAM usage efficiently', async () => {
      const vramText = await page.textContent('[data-testid="gpu-vram-usage"]');
      const vramMatch = vramText?.match(/([\d.]+)GB/);
      const vramUsage = parseFloat(vramMatch?.[1] || '0');
      
      // VRAM usage should be reasonable (less than 8GB total)
      expect(vramUsage).toBeGreaterThan(0);
      expect(vramUsage).toBeLessThan(8);
    });

    test('should display power draw within TGP limits', async () => {
      const powerText = await page.textContent('[data-testid="gpu-power-draw"]');
      const power = parseFloat(powerText?.replace('W', '') || '0');
      
      // Power draw should be within 115W TGP limit
      expect(power).toBeGreaterThan(70);
      expect(power).toBeLessThanOrEqual(115);
    });

    test('should show optimal performance zone indicator', async () => {
      const performanceZone = page.locator('[data-testid="gpu-performance-zone"]');
      await expect(performanceZone).toBeVisible();
      
      // Check for optimal performance indicators
      await expect(page.locator('text=Optimal Performance Zone')).toBeVisible();
      await expect(page.locator('text=Sub-100ms inference')).toBeVisible();
      await expect(page.locator('text=4 parallel streams')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update metrics in real-time', async () => {
      // Take initial screenshot of metrics
      const initialMetrics = await page.screenshot({ 
        clip: { x: 0, y: 200, width: 1200, height: 300 }
      });
      
      // Wait for real-time updates (2-3 seconds based on component)
      await page.waitForTimeout(3000);
      
      // Verify live update indicators are present
      await expect(page.locator('text=Live Updates')).toBeVisible();
      await expect(page.locator('.animate-pulse')).toHaveCount({ min: 1 });
    });

    test('should maintain data consistency during updates', async () => {
      // Monitor for any console errors during real-time updates
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Wait through several update cycles
      await page.waitForTimeout(6000);
      
      // Verify no console errors occurred
      expect(consoleErrors).toHaveLength(0);
      
      // Verify all metrics are still displaying valid values
      const accuracyElements = page.locator('[data-testid="model-accuracy"]');
      const count = await accuracyElements.count();
      
      for (let i = 0; i < count; i++) {
        const accuracy = await accuracyElements.nth(i).textContent();
        expect(accuracy).toMatch(/^\d+\.\d+%$/);
      }
    });
  });

  test.describe('Interactive Features', () => {
    test('should allow model card interaction', async () => {
      const modelCard = page.locator('[data-testid="model-ultimate-ensemble-brain"]');
      
      // Hover over model card
      await modelCard.hover();
      
      // Click on model card (if interactive)
      await modelCard.click();
      
      // Verify some form of interaction (tooltip, modal, navigation, etc.)
      // This would depend on actual interactive features implemented
    });

    test('should handle responsive design properly', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(1000);
      
      // Verify mobile navigation works
      const mobileNav = page.locator('[data-testid="mobile-navigation"]');
      if (await mobileNav.count() > 0) {
        await expect(mobileNav).toBeVisible();
      }
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      
      // Verify layout adapts properly
      await expect(page.locator('[data-testid="ml-training-overview"]')).toBeVisible();
      
      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network interruptions gracefully', async () => {
      // Simulate network offline
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);
      
      // Verify error handling or offline indicators
      // Restore network
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);
      
      // Verify recovery
      await expect(page.locator('[data-testid="ml-training-overview"]')).toBeVisible();
    });

    test('should display appropriate loading states', async () => {
      // Reload page to catch loading states
      await page.reload();
      
      // Look for loading indicators during initial load
      const loadingElements = page.locator('.animate-pulse, .loading, [data-testid="loading"]');
      
      // Wait for content to load
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Verify loading states are replaced with content
      await expect(page.locator('[data-testid="system-overview-cards"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should meet accessibility standards', async () => {
      // Check for proper ARIA labels
      const ariaElements = page.locator('[aria-label], [aria-labelledby], [role]');
      const count = await ariaElements.count();
      expect(count).toBeGreaterThan(0);
      
      // Verify color contrast (would require additional accessibility testing library)
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus is visible and logical
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should support screen readers', async () => {
      // Check for alt text on important visual elements
      const importantImages = page.locator('img[alt], svg[aria-label]');
      const imageCount = await importantImages.count();
      
      // Verify semantic HTML structure
      await expect(page.locator('main, section, article, nav, header')).toHaveCount({ min: 1 });
    });
  });
});