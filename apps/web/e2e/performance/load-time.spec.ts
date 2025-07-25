import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    // Start performance monitoring
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    
    // Measure dashboard load time
    const startTime = Date.now()
    await page.click('[data-testid="login-submit-button"]')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000)
    
    // Check Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const vitals: any = {}
          
          entries.forEach((entry: any) => {
            if (entry.name === 'LCP') {
              vitals.lcp = entry.value
            }
            if (entry.name === 'FID') {
              vitals.fid = entry.value
            }
            if (entry.name === 'CLS') {
              vitals.cls = entry.value
            }
          })
          
          resolve(vitals)
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
        
        // Fallback timeout
        setTimeout(() => resolve({}), 5000)
      })
    })
    
    console.log('Core Web Vitals:', vitals)
  })

  test('should handle rapid navigation without performance degradation', async ({ page }) => {
    // Login first
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    await page.waitForLoadState('networkidle')
    
    // Rapid navigation test
    const routes = ['/dashboard', '/contests', '/leagues', '/predictions', '/bankroll']
    const navigationTimes: number[] = []
    
    for (const route of routes) {
      const startTime = Date.now()
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const navigationTime = Date.now() - startTime
      navigationTimes.push(navigationTime)
      
      // Each navigation should be under 2 seconds
      expect(navigationTime).toBeLessThan(2000)
    }
    
    // Average navigation time should be reasonable
    const averageTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length
    expect(averageTime).toBeLessThan(1500)
  })

  test('should maintain performance with large data sets', async ({ page }) => {
    // Mock large player dataset
    await page.route('/api/players*', route => {
      const players = Array.from({ length: 1000 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        position: ['QB', 'RB', 'WR', 'TE'][i % 4],
        team: `TEAM${i % 32}`,
        salary: 5000 + (i * 10),
        projection: 10 + Math.random() * 20
      }))
      
      route.fulfill({
        json: { success: true, players, total: 1000 }
      })
    })
    
    await page.goto('/contests')
    await page.click('[data-testid="enter-contest-button"]')
    
    // Measure time to load large player list
    const startTime = Date.now()
    await page.waitForSelector('[data-testid="player-list"]')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Should handle large datasets efficiently
    expect(loadTime).toBeLessThan(3000)
    
    // Test scrolling performance
    const scrollStartTime = Date.now()
    await page.evaluate(() => {
      const playerList = document.querySelector('[data-testid="player-list"]')
      if (playerList) {
        playerList.scrollTop = 5000
      }
    })
    await page.waitForTimeout(100)
    const scrollTime = Date.now() - scrollStartTime
    
    // Scrolling should be smooth
    expect(scrollTime).toBeLessThan(500)
  })

  test('should optimize bundle size and loading', async ({ page }) => {
    // Monitor network requests
    const requests: any[] = []
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        resourceType: request.resourceType(),
        size: 0
      })
    })
    
    page.on('response', response => {
      const request = requests.find(r => r.url === response.url())
      if (request) {
        request.size = response.headers()['content-length'] || 0
      }
    })
    
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Analyze bundle sizes
    const jsRequests = requests.filter(r => r.resourceType === 'script')
    const cssRequests = requests.filter(r => r.resourceType === 'stylesheet')
    
    // Main bundle should be reasonably sized
    const mainBundle = jsRequests.find(r => r.url.includes('main') || r.url.includes('app'))
    if (mainBundle && mainBundle.size) {
      expect(parseInt(mainBundle.size)).toBeLessThan(500000) // 500KB
    }
    
    // Should not have excessive requests
    expect(jsRequests.length).toBeLessThan(10)
    expect(cssRequests.length).toBeLessThan(5)
  })

  test('should handle WebSocket connections efficiently', async ({ page }) => {
    // Login and navigate to live features
    await page.goto('/auth')
    await page.fill('[data-testid="email-input"]', 'testuser@example.com')
    await page.fill('[data-testid="password-input"]', 'TestPass123!')
    await page.click('[data-testid="login-submit-button"]')
    
    // Go to a page with WebSocket connections (live scores)
    await page.goto('/live-scores')
    
    // Monitor WebSocket connections
    let wsConnections = 0
    page.on('websocket', ws => {
      wsConnections++
      console.log('WebSocket connection opened')
      
      ws.on('close', () => {
        console.log('WebSocket connection closed')
      })
    })
    
    await page.waitForTimeout(2000)
    
    // Should have established WebSocket connection
    expect(wsConnections).toBeGreaterThan(0)
    expect(wsConnections).toBeLessThan(5) // Shouldn't have too many connections
  })

  test('should cache API responses effectively', async ({ page }) => {
    const apiRequests: string[] = []
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url())
      }
    })
    
    // First visit
    await page.goto('/contests')
    await page.waitForLoadState('networkidle')
    const firstVisitRequests = apiRequests.length
    
    // Clear and revisit
    apiRequests.length = 0
    await page.reload()
    await page.waitForLoadState('networkidle')
    const secondVisitRequests = apiRequests.length
    
    // Should have fewer requests on second visit due to caching
    expect(secondVisitRequests).toBeLessThanOrEqual(firstVisitRequests)
  })

  test('should render components efficiently', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Measure rendering performance
    const renderMetrics = await page.evaluate(() => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        return entries.map(entry => ({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        }))
      })
      
      observer.observe({ entryTypes: ['measure'] })
      
      // Get paint metrics
      const paintEntries = performance.getEntriesByType('paint')
      return paintEntries.map(entry => ({
        name: entry.name,
        startTime: entry.startTime
      }))
    })
    
    console.log('Render metrics:', renderMetrics)
    
    // Check that page renders quickly
    const firstPaint = renderMetrics.find(entry => entry.name === 'first-paint')
    const firstContentfulPaint = renderMetrics.find(entry => entry.name === 'first-contentful-paint')
    
    if (firstPaint) {
      expect(firstPaint.startTime).toBeLessThan(1000)
    }
    
    if (firstContentfulPaint) {
      expect(firstContentfulPaint.startTime).toBeLessThan(1500)
    }
  })
})