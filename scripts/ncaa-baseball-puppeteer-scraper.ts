import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE WITH PUPPETEER
const BROWSER_INSTANCES = 12; // Ryzen 5 7600X threads!
const CONCURRENT_PAGES = 24;  // 2 pages per browser
const BATCH_SIZE = 100;      
const pageLimit = pLimit(CONCURRENT_PAGES);

// Test with just one game first
async function testScrapeOneGame() {
  console.log(chalk.cyan('🔥 Testing Puppeteer NCAA Baseball Scraper\n'));

  try {
    // Launch browser with special WSL flags
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: '/usr/bin/chromium-browser' // Try system chromium
    });

    console.log(chalk.green('✅ Browser launched!'));

    const page = await browser.newPage();
    
    // Test with a real game
    const testGameId = '401638969';
    const url = `https://www.espn.com/college-baseball/boxscore/_/gameId/${testGameId}`;
    
    console.log(chalk.blue(`📊 Loading: ${url}`));
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log(chalk.green('✅ Page loaded!'));

    // Get the HTML
    const content = await page.content();
    const $ = cheerio.load(content);

    // Check what we can find
    const hasBoxScore = $('.Boxscore').length > 0;
    const hasBatting = $('*:contains("Batting")').length > 0;
    const hasPitching = $('*:contains("Pitching")').length > 0;
    const playerCount = $('.Table__TD a[href*="player"]').length;

    console.log(chalk.yellow('\n📊 Page Analysis:'));
    console.log(`- Has Box Score: ${hasBoxScore}`);
    console.log(`- Has Batting Section: ${hasBatting}`);
    console.log(`- Has Pitching Section: ${hasPitching}`);
    console.log(`- Player Links Found: ${playerCount}`);

    // Try to extract some batting stats
    console.log(chalk.yellow('\n🏏 Sample Batting Stats:'));
    
    $('.Boxscore__Category').each((_, category) => {
      const $category = $(category);
      const title = $category.find('.Table__Title').text();
      
      if (title.includes('Batting')) {
        console.log(chalk.blue(`\n${title}:`));
        
        $category.find('tbody tr').slice(0, 3).each((_, row) => {
          const cells = $(row).find('td').map((_, cell) => $(cell).text()).get();
          if (cells.length > 5) {
            console.log(`  ${cells[0]}: AB=${cells[1]}, R=${cells[2]}, H=${cells[3]}, RBI=${cells[4]}`);
          }
        });
      }
    });

    await browser.close();
    console.log(chalk.green('\n✅ Test successful! Puppeteer can scrape ESPN box scores!'));

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    console.log(chalk.yellow('\n💡 Trying alternative approach...'));
    
    // Try without special executable path
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      console.log(chalk.green('✅ Puppeteer launched with default Chrome!'));
      await browser.close();
      
    } catch (error2) {
      console.error(chalk.red('❌ Puppeteer also failed:'), error2);
    }
  }
}

testScrapeOneGame();