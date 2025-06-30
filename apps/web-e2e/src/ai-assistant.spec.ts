import { test, expect } from '@playwright/test'

// Helper to login before tests
async function loginUser(page: any) {
  await page.goto('/auth')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'Test123!@#')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/dashboard')
}

test.describe('AI Assistant Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page)
  })

  test('should navigate to voice assistant page', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on AI assistant link
    await page.getByRole('link', { name: /voice assistant|ai assistant/i }).click()
    
    // Should be on assistant page
    await expect(page).toHaveURL('/voice-assistant')
    await expect(page.locator('h1')).toContainText(/assistant/i)
  })

  test('should show chat interface', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Should show chat elements
    await expect(page.locator('.chat-container')).toBeVisible()
    await expect(page.locator('input[placeholder*="Ask"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('should send and receive messages', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Type a message
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Who should I start this week?')
    
    // Send message
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should show user message
    await expect(page.locator('.message.user')).toContainText('Who should I start this week?')
    
    // Should show loading indicator
    await expect(page.locator('.loading, .typing-indicator')).toBeVisible()
    
    // Should show AI response
    await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 })
  })

  test('should handle player queries', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Ask about a specific player
    await page.fill('input[placeholder*="Ask"]', 'How has Justin Jefferson been performing?')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should get response about the player
    await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.message.assistant')).toContainText(/Jefferson|stats|performance/i)
  })

  test('should handle trade analysis queries', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Ask about a trade
    await page.fill('input[placeholder*="Ask"]', 'Should I trade Tyreek Hill for Saquon Barkley?')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should get trade analysis
    await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.message.assistant')).toContainText(/trade|value|recommendation/i)
  })

  test('should maintain conversation context', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // First message
    await page.fill('input[placeholder*="Ask"]', 'Tell me about Patrick Mahomes')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.locator('.message.assistant').first()).toBeVisible({ timeout: 30000 })
    
    // Follow-up message using context
    await page.fill('input[placeholder*="Ask"]', 'What about his matchup this week?')
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should understand "his" refers to Mahomes
    await expect(page.locator('.message.assistant').nth(1)).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.message.assistant').nth(1)).toContainText(/Mahomes|matchup/i)
  })

  test('should handle voice input', async ({ page, browserName }) => {
    // Skip on browsers that don't support Web Speech API well in tests
    test.skip(browserName === 'webkit', 'Speech API not well supported in WebKit tests')
    
    await page.goto('/voice-assistant')
    
    // Should have microphone button
    const micButton = page.getByRole('button', { name: /microphone|voice|speak/i })
    await expect(micButton).toBeVisible()
    
    // Click microphone (would trigger permission request in real browser)
    await micButton.click()
    
    // Should show recording indicator or permission prompt
    await expect(page.locator('.recording, .permission-prompt')).toBeVisible()
  })

  test('should show suggested queries', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Should show suggestions
    await expect(page.locator('.suggestions, .quick-actions')).toBeVisible()
    
    // Click a suggestion
    const suggestion = page.locator('.suggestion-chip').first()
    const suggestionText = await suggestion.textContent()
    await suggestion.click()
    
    // Should populate input with suggestion
    const input = page.locator('input[placeholder*="Ask"]')
    await expect(input).toHaveValue(suggestionText || '')
  })

  test('should handle errors gracefully', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Send a very long message that might cause issues
    const longMessage = 'a'.repeat(1000)
    await page.fill('input[placeholder*="Ask"]', longMessage)
    await page.getByRole('button', { name: /send/i }).click()
    
    // Should show error message
    await expect(page.locator('.error, .message.error')).toBeVisible({ timeout: 10000 })
  })

  test('should clear chat history', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Send a message
    await page.fill('input[placeholder*="Ask"]', 'Test message')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.locator('.message')).toBeVisible()
    
    // Clear chat
    await page.getByRole('button', { name: /clear|new chat/i }).click()
    
    // Confirm if there's a dialog
    const dialog = page.locator('dialog, .modal')
    if (await dialog.isVisible()) {
      await page.getByRole('button', { name: /confirm|yes/i }).click()
    }
    
    // Messages should be cleared
    await expect(page.locator('.message')).not.toBeVisible()
  })
})

test.describe('AI Assistant Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page)
  })

  test('should handle rapid message sending', async ({ page }) => {
    await page.goto('/voice-assistant')
    
    // Send multiple messages quickly
    const messages = ['Question 1', 'Question 2', 'Question 3']
    
    for (const msg of messages) {
      await page.fill('input[placeholder*="Ask"]', msg)
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForTimeout(100) // Small delay
    }
    
    // All messages should be queued and processed
    await expect(page.locator('.message.user')).toHaveCount(3)
    
    // Should get responses for all (might take time)
    await expect(page.locator('.message.assistant')).toHaveCount(3, { timeout: 60000 })
  })
})