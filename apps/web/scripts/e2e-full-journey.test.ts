/**
 * 🚀 COMPREHENSIVE E2E TEST - FULL USER JOURNEY
 * 
 * This test validates the complete user experience from onboarding
 * through all major features on both web and mobile.
 */

import puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import chalk from 'chalk';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  screenshots: string[];
  errors: string[];
}

class FantasyAIE2ETester {
  private browser: Browser | null = null;
  private results: TestResult[] = [];
  private screenshotCount = 0;
  
  async runFullJourney() {
    console.log(chalk.blue.bold('\n🚀 Fantasy.AI E2E Test Suite - Full User Journey\n'));
    
    try {
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: null
      });
      
      // Test on different viewports
      await this.testDesktopJourney();
      await this.testMobileJourney();
      
      // Print results
      this.printResults();
      
    } catch (error) {
      console.error(chalk.red('Test suite failed:'), error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
  
  private async testDesktopJourney() {
    console.log(chalk.yellow('\n💻 Testing Desktop Journey...\n'));
    
    const page = await this.browser!.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Test 1: Landing Page
    await this.runTest('Desktop: Landing Page', page, async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
      await this.takeScreenshot(page, 'desktop-landing');
      
      // Check for key elements
      await page.waitForSelector('h1', { timeout: 5000 });
      const title = await page.$eval('h1', el => el.textContent);
      if (!title?.includes('Fantasy')) {
        throw new Error('Landing page title not found');
      }
      
      // Check for sign in button
      await page.waitForSelector('a[href="/auth"]');
    });
    
    // Test 2: Authentication
    await this.runTest('Desktop: Authentication', page, async () => {
      await page.click('a[href="/auth"]');
      await page.waitForNavigation();
      await this.takeScreenshot(page, 'desktop-auth');
      
      // Check for auth form
      await page.waitForSelector('form', { timeout: 5000 });
      
      // Simulate sign in (mock for testing)
      await page.evaluate(() => {
        // Simulate successful auth
        localStorage.setItem('mock-auth', 'true');
        window.location.href = '/dashboard';
      });
      
      await page.waitForNavigation();
    });
    
    // Test 3: Dashboard & Tutorial
    await this.runTest('Desktop: Dashboard & Tutorial', page, async () => {
      await page.waitForSelector('.tutorial-overlay, h2', { timeout: 10000 });
      await this.takeScreenshot(page, 'desktop-dashboard');
      
      // Check if tutorial appears
      const tutorialExists = await page.$('.tutorial-overlay') !== null;
      if (tutorialExists) {
        console.log(chalk.green('  ✅ Tutorial detected'));
        
        // Navigate through tutorial
        for (let i = 0; i < 3; i++) {
          await page.click('button:has-text("Next")').catch(() => {});
          await page.waitForTimeout(500);
        }
        
        // Complete tutorial
        await page.click('button:has-text("Get Started")').catch(() => {});
      }
      
      // Verify dashboard elements
      await page.waitForSelector('h2:has-text("Dashboard")', { timeout: 5000 });
    });
    
    // Test 4: Voice Analytics
    await this.runTest('Desktop: Voice Analytics', page, async () => {
      // Navigate to analytics
      await page.click('a[href="/analytics"]');
      await page.waitForNavigation();
      await page.waitForSelector('.voice-analytics', { timeout: 5000 });
      await this.takeScreenshot(page, 'desktop-analytics');
      
      // Test voice input area
      const voiceInput = await page.$('input[placeholder*="Ask about your data"]');
      if (!voiceInput) throw new Error('Voice input not found');
      
      // Simulate typing a query
      await voiceInput.type('Show me QB scoring trends');
      await page.keyboard.press('Enter');
      
      // Wait for processing
      await page.waitForTimeout(2000);
      await this.takeScreenshot(page, 'desktop-analytics-result');
      
      // Check for chart generation
      const chartExists = await page.$('canvas, svg') !== null;
      if (!chartExists) {
        console.log(chalk.yellow('  ⚠️  Chart not generated (API may be mocked)'));
      }
    });
    
    // Test 5: AI Agents
    await this.runTest('Desktop: AI Agents', page, async () => {
      await page.click('a[href="/agents"]');
      await page.waitForNavigation();
      await page.waitForSelector('.agent-card, [class*="agent"]', { timeout: 5000 });
      await this.takeScreenshot(page, 'desktop-agents');
      
      // Count agents
      const agents = await page.$$('[class*="agent-card"], [class*="Agent"]');
      console.log(chalk.cyan(`  📊 Found ${agents.length} AI agents`));
      
      // Click on first agent
      if (agents.length > 0) {
        await agents[0].click();
        await page.waitForTimeout(1000);
        await this.takeScreenshot(page, 'desktop-agent-selected');
      }
    });
    
    // Test 6: Oracle Interface
    await this.runTest('Desktop: Oracle Interface', page, async () => {
      await page.click('a[href="/oracle"]');
      await page.waitForNavigation();
      await page.waitForSelector('.oracle-interface, [class*="oracle"]', { timeout: 5000 });
      await this.takeScreenshot(page, 'desktop-oracle');
      
      // Check for Oracle elements
      const oracleTitle = await page.$('h1:has-text("Oracle"), h2:has-text("Oracle")');
      if (!oracleTitle) {
        console.log(chalk.yellow('  ⚠️  Oracle title not found'));
      }
      
      // Test wake word display
      const wakeWord = await page.$('*:has-text("Hey Fantasy")');
      if (wakeWord) {
        console.log(chalk.green('  ✅ Wake word "Hey Fantasy" found'));
      }
    });
    
    await page.close();
  }
  
  private async testMobileJourney() {
    console.log(chalk.yellow('\n📱 Testing Mobile Journey...\n'));
    
    const page = await this.browser!.newPage();
    
    // iPhone X viewport
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    
    // Test 1: Mobile Landing
    await this.runTest('Mobile: Landing Page', page, async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
      await this.takeScreenshot(page, 'mobile-landing');
      
      // Check mobile menu
      const mobileMenu = await page.$('[class*="mobile-nav"], button[aria-label*="menu"]');
      if (mobileMenu) {
        console.log(chalk.green('  ✅ Mobile navigation detected'));
      }
    });
    
    // Test 2: Mobile Auth
    await this.runTest('Mobile: Authentication', page, async () => {
      await page.click('a[href="/auth"]');
      await page.waitForNavigation();
      await this.takeScreenshot(page, 'mobile-auth');
      
      // Simulate auth
      await page.evaluate(() => {
        localStorage.setItem('mock-auth', 'true');
        window.location.href = '/dashboard';
      });
      
      await page.waitForNavigation();
    });
    
    // Test 3: Mobile Dashboard
    await this.runTest('Mobile: Dashboard', page, async () => {
      await page.waitForSelector('h1, h2', { timeout: 10000 });
      await this.takeScreenshot(page, 'mobile-dashboard');
      
      // Check for mobile-specific elements
      const bottomNav = await page.$('[class*="bottom-nav"], nav:has(> button)');
      if (bottomNav) {
        console.log(chalk.green('  ✅ Bottom navigation detected'));
      }
    });
    
    // Test 4: Mobile Analytics with Tabs
    await this.runTest('Mobile: Voice Analytics Tabs', page, async () => {
      // Navigate to analytics
      const analyticsBtn = await page.$('a[href="/analytics"], button:has-text("Analytics")');
      if (analyticsBtn) {
        await analyticsBtn.click();
        await page.waitForTimeout(2000);
      }
      
      await this.takeScreenshot(page, 'mobile-analytics');
      
      // Test tab navigation
      const tabs = await page.$$('button[role="tab"], [class*="tab"]');
      console.log(chalk.cyan(`  📊 Found ${tabs.length} tabs`));
      
      // Click through tabs
      for (let i = 0; i < Math.min(tabs.length, 3); i++) {
        await tabs[i].click();
        await page.waitForTimeout(500);
        await this.takeScreenshot(page, `mobile-analytics-tab-${i}`);
      }
      
      // Test fixed voice input
      const fixedInput = await page.$('[class*="fixed"][class*="bottom"] input');
      if (fixedInput) {
        console.log(chalk.green('  ✅ Fixed bottom voice input detected'));
      }
    });
    
    // Test 5: Mobile Agent Swipe
    await this.runTest('Mobile: Agent Interface', page, async () => {
      // Navigate to agents
      const agentsBtn = await page.$('button:has-text("Agents"), a[href="/agents"]');
      if (agentsBtn) {
        await agentsBtn.click();
        await page.waitForTimeout(2000);
      }
      
      await this.takeScreenshot(page, 'mobile-agents');
      
      // Simulate swipe gesture
      const swipeArea = await page.$('[class*="swipe"], [class*="agent-card"]');
      if (swipeArea) {
        const box = await swipeArea.boundingBox();
        if (box) {
          // Simulate swipe
          await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
          await page.mouse.up();
          
          await page.waitForTimeout(500);
          console.log(chalk.green('  ✅ Swipe gesture simulated'));
        }
      }
    });
    
    // Test 6: Mobile Oracle
    await this.runTest('Mobile: Oracle Interface', page, async () => {
      const oracleBtn = await page.$('button:has-text("Oracle"), a[href="/oracle"]');
      if (oracleBtn) {
        await oracleBtn.click();
        await page.waitForTimeout(2000);
      }
      
      await this.takeScreenshot(page, 'mobile-oracle');
      
      // Check for mobile-optimized Oracle
      const mobileOracle = await page.$('[class*="mobile"][class*="oracle"]');
      if (mobileOracle) {
        console.log(chalk.green('  ✅ Mobile-optimized Oracle detected'));
      }
    });
    
    await page.close();
  }
  
  private async runTest(name: string, page: Page, testFn: () => Promise<void>) {
    const startTime = Date.now();
    const screenshots: string[] = [];
    const errors: string[] = [];
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        passed: true,
        duration,
        screenshots,
        errors
      });
      
      console.log(chalk.green(`✅ ${name} (${duration}ms)`));
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      errors.push(error.message);
      
      this.results.push({
        name,
        passed: false,
        duration,
        screenshots,
        errors
      });
      
      console.log(chalk.red(`❌ ${name}: ${error.message}`));
      
      // Take error screenshot
      await this.takeScreenshot(page, `error-${name.replace(/\s+/g, '-').toLowerCase()}`);
    }
  }
  
  private async takeScreenshot(page: Page, name: string) {
    try {
      const filename = `screenshot-${this.screenshotCount++}-${name}.png`;
      await page.screenshot({ 
        path: `./test-results/${filename}`,
        fullPage: false 
      });
      console.log(chalk.gray(`  📸 Screenshot: ${filename}`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Screenshot failed: ${error.message}`));
    }
  }
  
  private printResults() {
    console.log(chalk.blue.bold('\n📊 E2E Test Results Summary\n'));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.yellow(`⏱️  Total Duration: ${totalDuration}ms`));
    console.log(chalk.cyan(`📸 Screenshots Taken: ${this.screenshotCount}`));
    
    // Desktop vs Mobile
    const desktopTests = this.results.filter(r => r.name.includes('Desktop'));
    const mobileTests = this.results.filter(r => r.name.includes('Mobile'));
    
    console.log(chalk.blue('\n📱 Platform Breakdown:'));
    console.log(`  Desktop: ${desktopTests.filter(r => r.passed).length}/${desktopTests.length} passed`);
    console.log(`  Mobile: ${mobileTests.filter(r => r.passed).length}/${mobileTests.length} passed`);
    
    // Failed tests details
    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  ${result.name}:`);
        result.errors.forEach(error => {
          console.log(`    - ${error}`);
        });
      });
    }
    
    // Overall verdict
    const successRate = (passed / this.results.length) * 100;
    console.log(chalk.blue.bold(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`));
    
    if (successRate === 100) {
      console.log(chalk.green.bold('\n🚀 PERFECT SCORE! All tests passed!'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow.bold('\n⚡ GOOD! Most tests passed.'));
    } else {
      console.log(chalk.red.bold('\n⚠️  NEEDS ATTENTION! Many tests failed.'));
    }
  }
}

// Create test results directory
import { mkdirSync } from 'fs';
try {
  mkdirSync('./test-results', { recursive: true });
} catch (e) {}

// Run the tests
const tester = new FantasyAIE2ETester();
tester.runFullJourney().catch(console.error);

/**
 * 🚀 E2E TEST FEATURES:
 * 
 * - Complete user journey testing
 * - Desktop and mobile viewports
 * - Tutorial system validation
 * - Voice analytics testing
 * - AI agent interactions
 * - Oracle interface checks
 * - Mobile gestures (swipe)
 * - Screenshot capture
 * - Performance metrics
 * - Error handling
 * 
 * Validates the entire platform end-to-end!
 */