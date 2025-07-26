import { test, expect } from '@playwright/test';

/**
 * 🔐 Admin Authentication E2E Tests
 * Critical security flow testing for admin panel access
 */

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
  });

  test('should display login form with all required fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Admin Login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toContainText('Email is required');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });

  test('should require MFA for valid credentials', async ({ page }) => {
    // Use test credentials from environment
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'testpassword';
    
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    
    // Should show MFA prompt
    await expect(page.locator('h2')).toContainText('Two-Factor Authentication');
    await expect(page.locator('input[name="mfaToken"]')).toBeVisible();
  });

  test('should successfully login with valid MFA token', async ({ page }) => {
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'testpassword';
    const mfaToken = process.env.TEST_MFA_TOKEN || '123456';
    
    // Enter credentials
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    
    // Enter MFA token
    await page.fill('input[name="mfaToken"]', mfaToken);
    await page.click('button[type="submit"]');
    
    // Should redirect to admin dashboard
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
  });

  test('should handle rate limiting after multiple failed attempts', async ({ page }) => {
    // Attempt login 6 times with wrong credentials
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'attacker@example.com');
      await page.fill('input[name="password"]', 'attempt' + i);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
    }
    
    // Should show rate limit error
    await expect(page.locator('.error-message')).toContainText('Too many failed attempts');
  });

  test('should maintain session across page refreshes', async ({ page, context }) => {
    // Login successfully
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'testpassword';
    const mfaToken = process.env.TEST_MFA_TOKEN || '123456';
    
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.fill('input[name="mfaToken"]', mfaToken);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('/admin/dashboard');
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'testpassword';
    const mfaToken = process.env.TEST_MFA_TOKEN || '123456';
    
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.fill('input[name="mfaToken"]', mfaToken);
    await page.click('button[type="submit"]');
    
    // Click logout
    await page.click('button[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL('/admin/login');
    
    // Try to access dashboard directly
    await page.goto('/admin/dashboard');
    
    // Should redirect back to login
    await expect(page).toHaveURL('/admin/login');
  });
});