import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should allow user to sign up successfully', async ({ page }) => {
    // Navigate to signup
    await page.click('text=Sign Up')
    
    // Fill out registration form
    await page.fill('[data-testid="email-input"]', 'newuser@example.com')
    await page.fill('[data-testid="username-input"]', 'newuser123')
    await page.fill('[data-testid="password-input"]', 'SecurePass123!')
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!')
    await page.check('[data-testid="accept-terms-checkbox"]')
    
    // Submit form
    await page.click('[data-testid="register-submit-button"]')
    
    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page).toHaveURL('/dashboard')
  })

  test('should allow user to log in successfully', async ({ page }) => {
    // Navigate to login
    await page.click('text=Sign In')
    
    // Fill out login form
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    
    // Submit form
    await page.click('[data-testid="login-submit-button"]')
    
    // Verify login success
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.click('text=Sign In')
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com')
    await page.fill('[data-testid="password-input"]', 'wrongpassword')
    
    await page.click('[data-testid="login-submit-button"]')
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')
  })

  test('should validate email format', async ({ page }) => {
    await page.click('text=Sign In')
    
    await page.fill('[data-testid="email-input"]', 'invalid-email')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    
    await page.click('[data-testid="login-submit-button"]')
    
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email')
  })

  test('should validate password strength on registration', async ({ page }) => {
    await page.click('text=Sign Up')
    
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="username-input"]', 'testuser')
    await page.fill('[data-testid="password-input"]', 'weak')
    
    await page.blur('[data-testid="password-input"]')
    
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must')
  })

  test('should require matching passwords on registration', async ({ page }) => {
    await page.click('text=Sign Up')
    
    await page.fill('[data-testid="password-input"]', 'SecurePass123!')
    await page.fill('[data-testid="confirm-password-input"]', 'DifferentPass123!')
    
    await page.blur('[data-testid="confirm-password-input"]')
    
    await expect(page.locator('[data-testid="confirm-password-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match')
  })

  test('should allow user to log out', async ({ page }) => {
    // Login first
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    
    await expect(page).toHaveURL('/dashboard')
    
    // Logout
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('[data-testid="logout-button"]')
    
    // Verify logout
    await expect(page).toHaveURL('/')
    await expect(page.locator('text=Sign In')).toBeVisible()
  })

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/dashboard')
    
    // Should redirect to auth page
    await expect(page).toHaveURL('/auth')
    await expect(page.locator('text=Sign In')).toBeVisible()
  })

  test('should redirect authenticated users away from auth page', async ({ page }) => {
    // Login first
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    
    await expect(page).toHaveURL('/dashboard')
    
    // Try to go back to auth page
    await page.goto('/auth')
    
    // Should redirect back to dashboard
    await expect(page).toHaveURL('/dashboard')
  })

  test('should handle session persistence across browser refresh', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    
    await expect(page).toHaveURL('/dashboard')
    
    // Refresh page
    await page.reload()
    
    // Should still be logged in
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible()
  })

  test('should show loading state during authentication', async ({ page }) => {
    await page.goto('/auth')
    
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    
    // Click submit and immediately check for loading state
    await page.click('[data-testid="login-submit-button"]')
    
    // Loading state should appear briefly
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible({ timeout: 1000 })
  })
})