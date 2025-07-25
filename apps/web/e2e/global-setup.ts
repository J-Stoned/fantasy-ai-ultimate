import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use
  
  console.log('=€ Starting global setup...')
  
  // Start the browser for setup
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Wait for the app to be ready
    console.log('ó Waiting for application to be ready...')
    await page.goto(baseURL!)
    await page.waitForSelector('body', { timeout: 30000 })
    
    // Check health endpoint
    const healthResponse = await page.request.get('/api/health')
    if (!healthResponse.ok()) {
      throw new Error('Health check failed')
    }
    
    console.log(' Application is ready')

    // Set up test data if needed
    await setupTestData(page)
    
    console.log(' Global setup complete')
    
  } catch (error) {
    console.error('L Global setup failed:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

async function setupTestData(page: any) {
  console.log('=Ê Setting up test data...')
  
  // Setup test users
  const testUsers = [
    {
      email: 'testuser@example.com',
      password: 'TestPass123!',
      username: 'testuser'
    }
  ]

  for (const user of testUsers) {
    try {
      // Create test user via API
      const response = await page.request.post('/api/auth/register', {
        data: {
          ...user,
          confirmPassword: user.password,
          acceptTerms: true
        }
      })
      
      if (response.ok()) {
        console.log(` Created test user: ${user.email}`)
      }
    } catch (error) {
      console.log(`9 Test user may already exist: ${user.email}`)
    }
  }
}

export default globalSetup