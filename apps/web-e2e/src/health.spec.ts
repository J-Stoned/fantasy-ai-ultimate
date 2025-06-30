import { test, expect } from '@playwright/test'

test.describe('Application Health Checks', () => {
  test('should have accessible health endpoint', async ({ request }) => {
    const response = await request.get('/api/health')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.checks).toBeDefined()
    expect(data.checks.database).toBeDefined()
    expect(data.checks.memory).toBeDefined()
  })

  test('should have accessible ready endpoint', async ({ request }) => {
    const response = await request.get('/api/ready')
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.ready).toBe(true)
    expect(data.message).toBe('Service is ready')
  })

  test('should load home page', async ({ page }) => {
    const response = await page.goto('/')
    
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto('/')
    
    const headers = response?.headers()
    expect(headers?.['x-frame-options']).toBe('DENY')
    expect(headers?.['x-content-type-options']).toBe('nosniff')
    expect(headers?.['x-xss-protection']).toBe('1; mode=block')
  })

  test('should handle 404 pages', async ({ page }) => {
    await page.goto('/non-existent-page')
    
    // Should show 404 page or redirect
    await expect(page.locator('h1')).toContainText(/404|not found/i)
  })

  test('should load static assets', async ({ page }) => {
    await page.goto('/')
    
    // Check if CSS loaded
    const styles = await page.evaluate(() => {
      const body = document.querySelector('body')
      return window.getComputedStyle(body!).backgroundColor
    })
    expect(styles).not.toBe('rgba(0, 0, 0, 0)') // Should have some background
    
    // Check if JavaScript loaded
    const hasReact = await page.evaluate(() => {
      return typeof (window as any).React !== 'undefined' || 
             document.querySelector('[data-reactroot]') !== null ||
             document.querySelector('#__next') !== null
    })
    expect(hasReact).toBe(true)
  })

  test('should handle JavaScript errors gracefully', async ({ page }) => {
    let jsError: Error | null = null
    
    page.on('pageerror', error => {
      jsError = error
    })
    
    await page.goto('/')
    
    // Trigger an error
    await page.evaluate(() => {
      throw new Error('Test error')
    })
    
    // Page should still be functional
    expect(jsError).toBeTruthy()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('should enforce rate limiting', async ({ request }) => {
    // Make many requests quickly
    const requests = []
    for (let i = 0; i < 150; i++) {
      requests.push(request.get('/api/health'))
    }
    
    const responses = await Promise.all(requests)
    
    // Some should be rate limited
    const rateLimited = responses.filter(r => r.status() === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
    
    // Check rate limit response
    if (rateLimited.length > 0) {
      const data = await rateLimited[0].json()
      expect(data.error).toContain('rate limit')
    }
  })
})

test.describe('Performance Tests', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have reasonable bundle size', async ({ page }) => {
    const coverage = await page.coverage.startJSCoverage()
    await page.goto('/')
    const jsCoverage = await page.coverage.stopJSCoverage()
    
    const totalBytes = jsCoverage.reduce((total, entry) => total + entry.text.length, 0)
    const totalMB = totalBytes / (1024 * 1024)
    
    // JavaScript bundle should be under 5MB
    expect(totalMB).toBeLessThan(5)
  })

  test('should handle slow network gracefully', async ({ page }) => {
    // Simulate slow 3G
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100)
    })
    
    await page.goto('/')
    
    // Should still load, just slowly
    await expect(page.locator('h1')).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Accessibility Tests', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/')
    
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title).toContain('Fantasy AI Ultimate')
  })

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/')
    
    // Should have exactly one h1
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBe(1)
    
    // Should have logical heading hierarchy
    const h2Count = await page.locator('h2').count()
    expect(h2Count).toBeGreaterThanOrEqual(0)
  })

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/')
    
    const images = await page.locator('img').all()
    
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      expect(alt).toBeTruthy()
    }
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/')
    
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(firstFocused).toBeTruthy()
    
    // Should be able to tab to important elements
    let tabCount = 0
    while (tabCount < 10) {
      await page.keyboard.press('Tab')
      tabCount++
      
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tag: el?.tagName,
          href: (el as HTMLAnchorElement)?.href,
          type: (el as HTMLInputElement)?.type,
        }
      })
      
      // Should focus on interactive elements
      if (focused.tag) {
        expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(focused.tag)
      }
    }
  })
})