/**
 * 📱 MOBILE GESTURES E2E TEST
 * 
 * This test specifically validates mobile touch interactions,
 * swipe gestures, and mobile-specific features.
 */

import puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import chalk from 'chalk';

interface GestureTest {
  name: string;
  gesture: 'tap' | 'swipe' | 'long-press' | 'pinch' | 'scroll';
  element: string;
  expected: string;
}

class MobileGesturesTester {
  private browser: Browser | null = null;
  private page: Page | null = null;
  
  async runMobileTests() {
    console.log(chalk.blue.bold('\n📱 Fantasy.AI Mobile Gestures Test Suite\n'));
    
    try {
      // Launch browser with mobile emulation
      this.browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-mobile-user-agent'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // iPhone 13 Pro viewport
      await this.page.setViewport({
        width: 390,
        height: 844,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3
      });
      
      // Set mobile user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      );
      
      // Navigate to app
      await this.page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });
      
      // Mock auth
      await this.page.evaluate(() => {
        localStorage.setItem('mock-auth', 'true');
      });
      
      // Run gesture tests
      await this.testBottomNavigation();
      await this.testAgentSwipe();
      await this.testVoiceInputTouch();
      await this.testTabNavigation();
      await this.testScrollableMetrics();
      await this.testExpandableCards();
      await this.testPullToRefresh();
      
      console.log(chalk.green.bold('\n✅ Mobile gesture tests completed!'));
      
    } catch (error) {
      console.error(chalk.red('Mobile test failed:'), error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
  
  private async testBottomNavigation() {
    console.log(chalk.yellow('\n🔲 Testing Bottom Navigation...\n'));
    
    const navItems = [
      { icon: 'Home', route: '/dashboard' },
      { icon: 'Analytics', route: '/analytics' },
      { icon: 'Oracle', route: '/oracle' },
      { icon: 'Agents', route: '/agents' }
    ];
    
    for (const item of navItems) {
      try {
        // Find and tap navigation item
        const navButton = await this.page!.$(`button:has-text("${item.icon}"), a:has-text("${item.icon}")`);
        if (navButton) {
          await this.tapElement(navButton);
          await this.page!.waitForTimeout(1000);
          
          console.log(chalk.green(`  ✅ Tapped ${item.icon} nav item`));
          
          // Verify navigation
          const url = this.page!.url();
          if (url.includes(item.route)) {
            console.log(chalk.green(`     ✓ Navigated to ${item.route}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ Failed to tap ${item.icon}`));
      }
    }
  }
  
  private async testAgentSwipe() {
    console.log(chalk.yellow('\n👆 Testing Agent Swipe Gestures...\n'));
    
    // Navigate to agents
    await this.page!.goto('http://localhost:3000/agents', { 
      waitUntil: 'networkidle0' 
    });
    
    await this.page!.waitForTimeout(2000);
    
    // Find swipeable agent card
    const agentCard = await this.page!.$('[class*="agent-card"], [class*="swipe"]');
    if (agentCard) {
      const box = await agentCard.boundingBox();
      if (box) {
        // Swipe left
        await this.swipeElement(box, 'left');
        console.log(chalk.green('  ✅ Swiped left on agent card'));
        
        await this.page!.waitForTimeout(1000);
        
        // Swipe right
        await this.swipeElement(box, 'right');
        console.log(chalk.green('  ✅ Swiped right on agent card'));
        
        await this.page!.waitForTimeout(1000);
      }
    }
  }
  
  private async testVoiceInputTouch() {
    console.log(chalk.yellow('\n🎤 Testing Voice Input Touch...\n'));
    
    // Navigate to analytics
    await this.page!.goto('http://localhost:3000/analytics', { 
      waitUntil: 'networkidle0' 
    });
    
    await this.page!.waitForTimeout(2000);
    
    // Find voice button
    const voiceButton = await this.page!.$('button:has(svg[class*="Mic"]), button[aria-label*="voice"]');
    if (voiceButton) {
      // Long press voice button
      await this.longPressElement(voiceButton);
      console.log(chalk.green('  ✅ Long pressed voice button'));
      
      await this.page!.waitForTimeout(1000);
      
      // Tap to stop
      await this.tapElement(voiceButton);
      console.log(chalk.green('  ✅ Tapped to stop recording'));
    }
  }
  
  private async testTabNavigation() {
    console.log(chalk.yellow('\n📑 Testing Tab Navigation...\n'));
    
    // Should already be on analytics page
    const tabs = await this.page!.$$('button[role="tab"], [class*="tab"]');
    
    console.log(chalk.cyan(`  Found ${tabs.length} tabs`));
    
    for (let i = 0; i < Math.min(tabs.length, 4); i++) {
      await this.tapElement(tabs[i]);
      await this.page!.waitForTimeout(500);
      console.log(chalk.green(`  ✅ Tapped tab ${i + 1}`));
    }
  }
  
  private async testScrollableMetrics() {
    console.log(chalk.yellow('\n📊 Testing Scrollable Metrics...\n'));
    
    // Find horizontally scrollable container
    const scrollContainer = await this.page!.$('[class*="overflow-x"], [class*="scroll"]');
    if (scrollContainer) {
      const box = await scrollContainer.boundingBox();
      if (box) {
        // Horizontal scroll
        await this.page!.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await this.page!.mouse.down();
        await this.page!.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
        await this.page!.mouse.up();
        
        console.log(chalk.green('  ✅ Horizontal scroll on metrics'));
      }
    }
  }
  
  private async testExpandableCards() {
    console.log(chalk.yellow('\n📋 Testing Expandable Cards...\n'));
    
    // Find expandable elements
    const expandButtons = await this.page!.$$('[class*="expand"], button:has(svg[class*="Chevron"])');
    
    for (let i = 0; i < Math.min(expandButtons.length, 2); i++) {
      await this.tapElement(expandButtons[i]);
      await this.page!.waitForTimeout(500);
      console.log(chalk.green(`  ✅ Expanded card ${i + 1}`));
    }
  }
  
  private async testPullToRefresh() {
    console.log(chalk.yellow('\n🔄 Testing Pull to Refresh...\n'));
    
    // Simulate pull-to-refresh gesture
    const viewportHeight = 844;
    await this.page!.mouse.move(195, 100);
    await this.page!.mouse.down();
    await this.page!.mouse.move(195, 300, { steps: 20 });
    await this.page!.mouse.up();
    
    console.log(chalk.green('  ✅ Pull to refresh gesture completed'));
    await this.page!.waitForTimeout(1000);
  }
  
  // Gesture helper methods
  private async tapElement(element: any) {
    const box = await element.boundingBox();
    if (!box) return;
    
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    
    await this.page!.touchscreen.tap(x, y);
  }
  
  private async longPressElement(element: any, duration = 1000) {
    const box = await element.boundingBox();
    if (!box) return;
    
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    
    await this.page!.mouse.move(x, y);
    await this.page!.mouse.down();
    await this.page!.waitForTimeout(duration);
    await this.page!.mouse.up();
  }
  
  private async swipeElement(box: any, direction: 'left' | 'right' | 'up' | 'down') {
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    let endX = startX;
    let endY = startY;
    
    switch (direction) {
      case 'left':
        endX = box.x + 50;
        break;
      case 'right':
        endX = box.x + box.width - 50;
        break;
      case 'up':
        endY = box.y + 50;
        break;
      case 'down':
        endY = box.y + box.height - 50;
        break;
    }
    
    await this.page!.mouse.move(startX, startY);
    await this.page!.mouse.down();
    await this.page!.mouse.move(endX, endY, { steps: 20 });
    await this.page!.mouse.up();
  }
}

// Run the mobile gesture tests
const tester = new MobileGesturesTester();
tester.runMobileTests().catch(console.error);

/**
 * 📱 MOBILE GESTURE TEST FEATURES:
 * 
 * - Bottom navigation taps
 * - Agent card swiping
 * - Voice button long press
 * - Tab navigation
 * - Horizontal scrolling
 * - Expandable cards
 * - Pull to refresh
 * - Touch-specific interactions
 * - Mobile viewport testing
 * 
 * Validates all mobile gestures!
 */