import { test, expect } from '@playwright/test';

/**
 * 🤖 ML Training Dashboard E2E Tests
 * Testing critical ML model training and monitoring flows
 */

test.describe('ML Training Dashboard', () => {
  test.use({
    storageState: 'tests/e2e/.auth/admin.json' // Pre-authenticated state
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/ml-training');
  });

  test('should display ML training dashboard with all sections', async ({ page }) => {
    // Check main sections
    await expect(page.locator('h1')).toContainText('ML Training Dashboard');
    await expect(page.locator('[data-testid="model-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="training-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="gpu-monitor"]')).toBeVisible();
    await expect(page.locator('[data-testid="training-controls"]')).toBeVisible();
  });

  test('should load available models', async ({ page }) => {
    const modelSelector = page.locator('[data-testid="model-selector"]');
    await modelSelector.click();
    
    // Should show model options
    await expect(page.locator('option[value="nfl-predictor"]')).toBeVisible();
    await expect(page.locator('option[value="nba-predictor"]')).toBeVisible();
    await expect(page.locator('option[value="mlb-predictor"]')).toBeVisible();
    await expect(page.locator('option[value="nhl-predictor"]')).toBeVisible();
  });

  test('should display real-time training metrics', async ({ page }) => {
    // Select a model
    await page.selectOption('[data-testid="model-selector"]', 'nfl-predictor');
    
    // Check metrics display
    await expect(page.locator('[data-testid="accuracy-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="loss-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="epoch-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="training-speed"]')).toBeVisible();
  });

  test('should start training process', async ({ page }) => {
    // Select model and parameters
    await page.selectOption('[data-testid="model-selector"]', 'nfl-predictor');
    await page.fill('[data-testid="epochs-input"]', '10');
    await page.fill('[data-testid="batch-size-input"]', '32');
    
    // Start training
    await page.click('[data-testid="start-training-button"]');
    
    // Should show training in progress
    await expect(page.locator('[data-testid="training-status"]')).toContainText('Training in progress');
    await expect(page.locator('[data-testid="stop-training-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="start-training-button"]')).toBeDisabled();
  });

  test('should update progress in real-time', async ({ page }) => {
    // Start training
    await page.selectOption('[data-testid="model-selector"]', 'nfl-predictor');
    await page.click('[data-testid="start-training-button"]');
    
    // Get initial epoch
    const initialEpoch = await page.locator('[data-testid="current-epoch"]').textContent();
    
    // Wait for progress
    await page.waitForTimeout(5000);
    
    // Epoch should have increased
    const currentEpoch = await page.locator('[data-testid="current-epoch"]').textContent();
    expect(parseInt(currentEpoch || '0')).toBeGreaterThan(parseInt(initialEpoch || '0'));
  });

  test('should display GPU utilization metrics', async ({ page }) => {
    // GPU metrics should be visible
    await expect(page.locator('[data-testid="gpu-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="gpu-memory"]')).toBeVisible();
    await expect(page.locator('[data-testid="gpu-temperature"]')).toBeVisible();
    
    // Should show percentage values
    const gpuUsage = await page.locator('[data-testid="gpu-usage"]').textContent();
    expect(gpuUsage).toMatch(/\d+%/);
  });

  test('should stop training process', async ({ page }) => {
    // Start training
    await page.selectOption('[data-testid="model-selector"]', 'nfl-predictor');
    await page.click('[data-testid="start-training-button"]');
    
    // Wait for training to start
    await page.waitForSelector('[data-testid="stop-training-button"]');
    
    // Stop training
    await page.click('[data-testid="stop-training-button"]');
    
    // Should show stopped status
    await expect(page.locator('[data-testid="training-status"]')).toContainText('Training stopped');
    await expect(page.locator('[data-testid="start-training-button"]')).toBeEnabled();
  });

  test('should save training checkpoint', async ({ page }) => {
    // Start training
    await page.selectOption('[data-testid="model-selector"]', 'nfl-predictor');
    await page.click('[data-testid="start-training-button"]');
    
    // Wait for some progress
    await page.waitForTimeout(3000);
    
    // Save checkpoint
    await page.click('[data-testid="save-checkpoint-button"]');
    
    // Should show success message
    await expect(page.locator('.success-toast')).toContainText('Checkpoint saved');
  });

  test('should display training history', async ({ page }) => {
    await page.click('[data-testid="training-history-tab"]');
    
    // Should show previous training runs
    await expect(page.locator('[data-testid="history-table"]')).toBeVisible();
    await expect(page.locator('tr[data-testid="history-row"]').first()).toBeVisible();
    
    // Should have columns
    await expect(page.locator('th')).toContainText(['Model', 'Date', 'Epochs', 'Final Accuracy', 'Duration']);
  });

  test('should export model after training', async ({ page }) => {
    // Navigate to completed model
    await page.click('[data-testid="training-history-tab"]');
    await page.click('tr[data-testid="history-row"]').first();
    
    // Export model
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-model-button"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/model-.*\.pkl/);
  });

  test('should show performance comparison chart', async ({ page }) => {
    await page.click('[data-testid="performance-tab"]');
    
    // Should show chart
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    
    // Should have legend
    await expect(page.locator('[data-testid="chart-legend"]')).toContainText(['NFL', 'NBA', 'MLB', 'NHL']);
  });
});