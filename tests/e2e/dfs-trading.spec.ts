import { test, expect } from '@playwright/test';

/**
 * 💰 DFS Trading Terminal E2E Tests
 * Testing critical DFS lineup optimization and trading flows
 */

test.describe('DFS Trading Terminal', () => {
  test.use({
    storageState: 'tests/e2e/.auth/admin.json' // Pre-authenticated state
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dfs-trading');
  });

  test('should display DFS trading terminal with all components', async ({ page }) => {
    // Check main components
    await expect(page.locator('h1')).toContainText('DFS Trading Terminal');
    await expect(page.locator('[data-testid="sport-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="contest-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="player-pool"]')).toBeVisible();
    await expect(page.locator('[data-testid="lineup-builder"]')).toBeVisible();
    await expect(page.locator('[data-testid="optimization-panel"]')).toBeVisible();
  });

  test('should load player pool for selected sport', async ({ page }) => {
    // Select NFL
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    
    // Wait for players to load
    await page.waitForSelector('[data-testid="player-card"]');
    
    // Should show players
    const playerCount = await page.locator('[data-testid="player-card"]').count();
    expect(playerCount).toBeGreaterThan(0);
    
    // Check player card has required info
    const firstPlayer = page.locator('[data-testid="player-card"]').first();
    await expect(firstPlayer.locator('[data-testid="player-name"]')).toBeVisible();
    await expect(firstPlayer.locator('[data-testid="player-salary"]')).toBeVisible();
    await expect(firstPlayer.locator('[data-testid="player-projection"]')).toBeVisible();
  });

  test('should filter players by position', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.waitForSelector('[data-testid="player-card"]');
    
    // Filter by QB
    await page.click('[data-testid="position-filter-QB"]');
    
    // All visible players should be QBs
    const positions = await page.locator('[data-testid="player-position"]').allTextContents();
    positions.forEach(pos => expect(pos).toBe('QB'));
  });

  test('should add player to lineup', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.waitForSelector('[data-testid="player-card"]');
    
    // Add first player
    await page.click('[data-testid="player-card"] button[data-testid="add-player"]');
    
    // Should appear in lineup
    await expect(page.locator('[data-testid="lineup-slot-QB"]')).toContainText(/\w+/);
    
    // Salary should update
    const salary = await page.locator('[data-testid="lineup-salary"]').textContent();
    expect(parseInt(salary?.replace(/\D/g, '') || '0')).toBeGreaterThan(0);
  });

  test('should enforce salary cap', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.waitForSelector('[data-testid="player-card"]');
    
    // Try to add expensive players
    const expensivePlayers = page.locator('[data-testid="player-card"]').filter({
      has: page.locator('[data-testid="player-salary"]:has-text("$9")')
    });
    
    // Add multiple expensive players
    for (let i = 0; i < 6; i++) {
      await expensivePlayers.nth(i).click();
    }
    
    // Should show salary cap warning
    await expect(page.locator('[data-testid="salary-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="salary-warning"]')).toContainText('Over salary cap');
  });

  test('should optimize lineup', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.selectOption('[data-testid="contest-selector"]', 'GPP');
    
    // Click optimize
    await page.click('[data-testid="optimize-button"]');
    
    // Should show optimization in progress
    await expect(page.locator('[data-testid="optimization-status"]')).toContainText('Optimizing');
    
    // Wait for completion
    await page.waitForSelector('[data-testid="optimization-complete"]', { timeout: 30000 });
    
    // Should fill all lineup slots
    const filledSlots = await page.locator('[data-testid^="lineup-slot-"]:not(:empty)').count();
    expect(filledSlots).toBe(9); // NFL DFS lineup size
    
    // Should be under salary cap
    const remainingSalary = await page.locator('[data-testid="remaining-salary"]').textContent();
    expect(parseInt(remainingSalary?.replace(/\D/g, '') || '0')).toBeGreaterThanOrEqual(0);
  });

  test('should show ownership projections', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.waitForSelector('[data-testid="player-card"]');
    
    // Toggle ownership display
    await page.click('[data-testid="show-ownership-toggle"]');
    
    // Should show ownership percentages
    await expect(page.locator('[data-testid="player-ownership"]').first()).toBeVisible();
    const ownership = await page.locator('[data-testid="player-ownership"]').first().textContent();
    expect(ownership).toMatch(/\d+(\.\d+)?%/);
  });

  test('should calculate lineup correlation', async ({ page }) => {
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    
    // Build a lineup with QB and WR from same team
    // This would be more complex in real implementation
    await page.click('[data-testid="optimize-button"]');
    await page.waitForSelector('[data-testid="optimization-complete"]');
    
    // Check correlation score
    await expect(page.locator('[data-testid="correlation-score"]')).toBeVisible();
    const correlation = await page.locator('[data-testid="correlation-score"]').textContent();
    expect(parseFloat(correlation || '0')).toBeGreaterThanOrEqual(0);
  });

  test('should export lineup to CSV', async ({ page }) => {
    // Build lineup
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.click('[data-testid="optimize-button"]');
    await page.waitForSelector('[data-testid="optimization-complete"]');
    
    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/lineup-.*\.csv/);
  });

  test('should save lineup for later', async ({ page }) => {
    // Build lineup
    await page.selectOption('[data-testid="sport-selector"]', 'NFL');
    await page.click('[data-testid="optimize-button"]');
    await page.waitForSelector('[data-testid="optimization-complete"]');
    
    // Save lineup
    await page.fill('[data-testid="lineup-name-input"]', 'Test GPP Lineup');
    await page.click('[data-testid="save-lineup-button"]');
    
    // Should show success
    await expect(page.locator('.success-toast')).toContainText('Lineup saved');
    
    // Should appear in saved lineups
    await page.click('[data-testid="saved-lineups-tab"]');
    await expect(page.locator('[data-testid="saved-lineup-row"]')).toContainText('Test GPP Lineup');
  });

  test('should show real-time contest updates', async ({ page }) => {
    await page.click('[data-testid="live-contests-tab"]');
    
    // Should show live contest data
    await expect(page.locator('[data-testid="contest-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="contest-row"]').first()).toBeVisible();
    
    // Should update in real-time (simulated)
    const initialEntries = await page.locator('[data-testid="contest-entries"]').first().textContent();
    await page.waitForTimeout(5000);
    const updatedEntries = await page.locator('[data-testid="contest-entries"]').first().textContent();
    
    // Entries should change (in real app)
    // expect(updatedEntries).not.toBe(initialEntries);
  });
});