import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should redirect unauthenticated users to login page', async ({ page }) => {
    // Navigate to a protected page
    await page.goto('/dashboard')
    
    // Should be redirected to auth page
    await expect(page).toHaveURL('/auth')
    
    // Should show login form
    await expect(page.locator('h1')).toContainText('Sign in')
  })

  test('should allow user to sign up', async ({ page }) => {
    await page.goto('/auth')
    
    // Switch to sign up mode
    await page.getByText('Sign up').click()
    
    // Fill in sign up form
    await page.fill('input[type="email"]', 'testuser@example.com')
    await page.fill('input[type="password"]', 'Test123!@#')
    
    // Submit form
    await page.getByRole('button', { name: /sign up/i }).click()
    
    // Should show success message or redirect
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })

  test('should allow user to sign in', async ({ page }) => {
    await page.goto('/auth')
    
    // Fill in login form
    await page.fill('input[type="email"]', 'existing@example.com')
    await page.fill('input[type="password"]', 'Test123!@#')
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth')
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click()
    
    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText(/invalid|incorrect/i)
  })

  test('should allow user to sign out', async ({ page, context }) => {
    // First sign in
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'Test123!@#')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/dashboard')
    
    // Sign out
    await page.getByRole('button', { name: /sign out/i }).click()
    
    // Should redirect to home or auth page
    await expect(page).toHaveURL(/^\/(auth)?$/)
    
    // Should not be able to access protected pages
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/auth')
  })
})

test.describe('Protected Routes', () => {
  test('should protect all dashboard routes', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/import-league',
      '/players',
      '/ml-predictions',
      '/voice-assistant',
      '/ar-stats',
      '/contests',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL('/auth')
    }
  })
})