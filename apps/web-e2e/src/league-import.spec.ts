import { test, expect } from '@playwright/test'

// Helper to login before tests
async function loginUser(page: any) {
  await page.goto('/auth')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'Test123!@#')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/dashboard')
}

test.describe('League Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page)
  })

  test('should navigate to league import page', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on import league button/link
    await page.getByRole('link', { name: /import league/i }).click()
    
    // Should be on import page
    await expect(page).toHaveURL('/import-league')
    await expect(page.locator('h1')).toContainText(/import.*league/i)
  })

  test('should show platform selection', async ({ page }) => {
    await page.goto('/import-league')
    
    // Should show platform options
    await expect(page.getByText('Sleeper')).toBeVisible()
    await expect(page.getByText('ESPN')).toBeVisible()
    await expect(page.getByText('Yahoo')).toBeVisible()
  })

  test('should import Sleeper league', async ({ page }) => {
    await page.goto('/import-league')
    
    // Select Sleeper platform
    await page.getByRole('button', { name: 'Sleeper' }).click()
    
    // Enter username
    await page.fill('input[placeholder*="username"]', 'testuser123')
    
    // Submit form
    await page.getByRole('button', { name: /import/i }).click()
    
    // Should show loading state
    await expect(page.locator('.loading')).toBeVisible()
    
    // Should eventually show success or error
    await expect(page.locator('.success, .error')).toBeVisible({ timeout: 30000 })
  })

  test('should validate username format', async ({ page }) => {
    await page.goto('/import-league')
    
    // Select Sleeper
    await page.getByRole('button', { name: 'Sleeper' }).click()
    
    // Enter invalid username
    await page.fill('input[placeholder*="username"]', 'invalid username!')
    
    // Submit
    await page.getByRole('button', { name: /import/i }).click()
    
    // Should show validation error
    await expect(page.locator('.error')).toContainText(/invalid.*username/i)
  })

  test('should handle import errors gracefully', async ({ page }) => {
    await page.goto('/import-league')
    
    // Select platform
    await page.getByRole('button', { name: 'Sleeper' }).click()
    
    // Enter non-existent username
    await page.fill('input[placeholder*="username"]', 'nonexistentuser999')
    
    // Submit
    await page.getByRole('button', { name: /import/i }).click()
    
    // Should show error message
    await expect(page.locator('.error')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.error')).toContainText(/not found|error/i)
  })

  test('should show imported leagues in dashboard', async ({ page }) => {
    // First import a league
    await page.goto('/import-league')
    await page.getByRole('button', { name: 'Sleeper' }).click()
    await page.fill('input[placeholder*="username"]', 'validuser')
    await page.getByRole('button', { name: /import/i }).click()
    
    // Wait for success
    await expect(page.locator('.success')).toBeVisible({ timeout: 30000 })
    
    // Go to dashboard
    await page.goto('/dashboard')
    
    // Should show imported league
    await expect(page.locator('.league-card')).toBeVisible()
  })
})

test.describe('League Import Rate Limiting', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page)
  })

  test('should enforce rate limits on imports', async ({ page }) => {
    await page.goto('/import-league')
    
    // Try to import multiple times quickly
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Sleeper' }).click()
      await page.fill('input[placeholder*="username"]', `user${i}`)
      await page.getByRole('button', { name: /import/i }).click()
      
      // Wait a bit between requests
      await page.waitForTimeout(1000)
    }
    
    // Should eventually hit rate limit
    await expect(page.locator('.error')).toContainText(/rate limit|too many/i)
  })
})