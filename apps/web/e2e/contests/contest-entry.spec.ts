import { test, expect } from '@playwright/test'

test.describe('Contest Entry Flow', () => {
  // Setup authenticated user for all tests
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('should display available contests', async ({ page }) => {
    await page.goto('/contests')
    
    // Wait for contests to load
    await expect(page.locator('[data-testid="contests-list"]')).toBeVisible()
    
    // Check that contests are displayed
    await expect(page.locator('[data-testid="contest-card"]').first()).toBeVisible()
    
    // Verify contest information is shown
    await expect(page.locator('[data-testid="contest-name"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="contest-entry-fee"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="contest-prize-pool"]').first()).toBeVisible()
  })

  test('should allow filtering contests by sport', async ({ page }) => {
    await page.goto('/contests')
    
    // Apply NFL filter
    await page.click('[data-testid="sport-filter-nfl"]')
    
    // Wait for filtered results
    await page.waitForTimeout(1000)
    
    // Verify only NFL contests are shown
    const contestCards = page.locator('[data-testid="contest-card"]')
    const count = await contestCards.count()
    
    for (let i = 0; i < count; i++) {
      const sport = await contestCards.nth(i).locator('[data-testid="contest-sport"]').textContent()
      expect(sport).toBe('NFL')
    }
  })

  test('should show contest details in modal', async ({ page }) => {
    await page.goto('/contests')
    
    // Click on first contest
    await page.click('[data-testid="contest-card"]')
    
    // Verify modal opens
    await expect(page.locator('[data-testid="contest-details-modal"]')).toBeVisible()
    
    // Check modal content
    await expect(page.locator('[data-testid="contest-details-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="contest-details-rules"]')).toBeVisible()
    await expect(page.locator('[data-testid="contest-details-scoring"]')).toBeVisible()
    await expect(page.locator('[data-testid="enter-contest-button"]')).toBeVisible()
  })

  test('should navigate to lineup builder when entering contest', async ({ page }) => {
    await page.goto('/contests')
    
    // Click enter contest button
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    // Should navigate to lineup builder
    await expect(page).toHaveURL(/\/lineup-builder/)
    
    // Verify lineup builder is loaded
    await expect(page.locator('[data-testid="lineup-builder"]')).toBeVisible()
    await expect(page.locator('[data-testid="player-pool"]')).toBeVisible()
    await expect(page.locator('[data-testid="lineup-slots"]')).toBeVisible()
  })

  test('should build and submit a valid lineup', async ({ page }) => {
    await page.goto('/contests')
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    await expect(page).toHaveURL(/\/lineup-builder/)
    
    // Build lineup by adding players to each position
    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST', 'K']
    
    for (const position of positions) {
      // Click position slot
      await page.click(`[data-testid="lineup-slot-${position.toLowerCase()}"]`)
      
      // Select first available player for this position
      await page.click(`[data-testid="player-${position.toLowerCase()}"]`)
      
      // Wait for player to be added
      await page.waitForTimeout(500)
    }
    
    // Verify lineup is complete
    await expect(page.locator('[data-testid="lineup-complete-indicator"]')).toBeVisible()
    
    // Submit lineup
    await page.click('[data-testid="submit-lineup-button"]')
    
    // Verify entry success
    await expect(page.locator('[data-testid="entry-success-message"]')).toBeVisible()
  })

  test('should validate salary cap constraints', async ({ page }) => {
    await page.goto('/contests')
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    // Try to add expensive players that exceed salary cap
    // This test assumes there are expensive players available
    
    // Add multiple high-salary players
    await page.click('[data-testid="sort-by-salary"]')
    
    // Add highest salary players
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="add-player-button"]')
      await page.waitForTimeout(300)
    }
    
    // Check that salary cap warning appears
    await expect(page.locator('[data-testid="salary-cap-warning"]')).toBeVisible()
    
    // Submit button should be disabled
    await expect(page.locator('[data-testid="submit-lineup-button"]')).toBeDisabled()
  })

  test('should show player projections and stats', async ({ page }) => {
    await page.goto('/contests')
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    // Click on a player to see details
    await page.click('[data-testid="player-card"]')
    
    // Verify player details modal
    await expect(page.locator('[data-testid="player-details-modal"]')).toBeVisible()
    
    // Check that key information is displayed
    await expect(page.locator('[data-testid="player-projection"]')).toBeVisible()
    await expect(page.locator('[data-testid="player-recent-stats"]')).toBeVisible()
    await expect(page.locator('[data-testid="player-matchup-info"]')).toBeVisible()
  })

  test('should handle contest entry with insufficient funds', async ({ page }) => {
    // Mock low bankroll
    await page.route('/api/bankroll/user', route => {
      route.fulfill({
        json: {
          success: true,
          bankroll: {
            current: 5,
            available: 5,
            reserved: 0
          }
        }
      })
    })
    
    await page.goto('/contests')
    
    // Try to enter expensive contest
    await page.click('[data-testid="contest-card"][data-entry-fee="25"] [data-testid="enter-contest-button"]')
    
    // Should show insufficient funds error
    await expect(page.locator('[data-testid="insufficient-funds-error"]')).toBeVisible()
    
    // Should not navigate to lineup builder
    await expect(page).toHaveURL('/contests')
  })

  test('should save lineup as draft', async ({ page }) => {
    await page.goto('/contests')
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    // Add a few players
    await page.click('[data-testid="add-player-button"]')
    await page.waitForTimeout(300)
    await page.click('[data-testid="add-player-button"]')
    
    // Save as draft
    await page.click('[data-testid="save-draft-button"]')
    
    // Verify draft saved
    await expect(page.locator('[data-testid="draft-saved-message"]')).toBeVisible()
    
    // Navigate away and back
    await page.goto('/dashboard')
    await page.goto('/contests')
    
    // Check that draft is preserved
    await expect(page.locator('[data-testid="saved-drafts"]')).toBeVisible()
  })

  test('should show live contest updates', async ({ page }) => {
    // Enter a live contest first
    await page.goto('/contests')
    await page.click('[data-testid="live-contest-card"] [data-testid="view-contest-button"]')
    
    // Verify live updates are working
    await expect(page.locator('[data-testid="live-scores"]')).toBeVisible()
    await expect(page.locator('[data-testid="leaderboard"]')).toBeVisible()
    
    // Check for real-time updates (this is a simplified check)
    const initialScore = await page.locator('[data-testid="user-score"]').textContent()
    
    // Wait a moment for potential updates
    await page.waitForTimeout(2000)
    
    // Score element should still be visible (real updates would need WebSocket mocking)
    await expect(page.locator('[data-testid="user-score"]')).toBeVisible()
  })

  test('should handle contest entry deadline', async ({ page }) => {
    // Mock expired contest
    await page.route('/api/contests', route => {
      route.fulfill({
        json: {
          success: true,
          contests: [{
            id: 'expired-contest',
            name: 'Expired Contest',
            sport: 'NFL',
            entryFee: 25,
            startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            isExpired: true
          }]
        }
      })
    })
    
    await page.goto('/contests')
    
    // Try to enter expired contest
    await page.click('[data-testid="contest-card"] [data-testid="enter-contest-button"]')
    
    // Should show deadline passed error
    await expect(page.locator('[data-testid="deadline-passed-error"]')).toBeVisible()
  })
})