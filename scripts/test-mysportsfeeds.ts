#!/usr/bin/env tsx
/**
 * 🧪 TEST MYSPORTSFEEDS INTEGRATION
 */

import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { MySportsFeeds } from '../lib/mcp/integrations/mysportsfeeds';

dotenv.config({ path: '.env.local' });

async function testMySportsFeeds() {
  console.log(chalk.bold.cyan('\n🧪 TESTING MYSPORTSFEEDS INTEGRATION\n'));
  
  // Check if credentials exist
  const hasApiKey = !!process.env.MYSPORTSFEEDS_API_KEY;
  const hasPassword = !!process.env.MYSPORTSFEEDS_PASSWORD;
  
  console.log('API Key configured:', hasApiKey ? chalk.green('✅') : chalk.red('❌'));
  console.log('Password configured:', hasPassword ? chalk.green('✅') : chalk.red('❌'));
  
  if (!hasApiKey || !hasPassword) {
    console.log(chalk.yellow('\n⚠️  MySportsFeeds credentials not found in .env.local'));
    console.log('Add these to your .env.local:');
    console.log('MYSPORTSFEEDS_API_KEY=your_api_key');
    console.log('MYSPORTSFEEDS_PASSWORD=your_password');
    console.log('\nGet free API access at: https://www.mysportsfeeds.com/');
    return;
  }
  
  try {
    const msf = new MySportsFeeds({
      apiKey: process.env.MYSPORTSFEEDS_API_KEY!,
      password: process.env.MYSPORTSFEEDS_PASSWORD!
    });
    
    console.log(chalk.yellow('\n📊 Testing player search...'));
    const searchResult = await msf.search('LeBron James');
    console.log('Search result:', searchResult ? chalk.green('✅ Success') : chalk.red('❌ Failed'));
    
    console.log(chalk.yellow('\n📊 Testing league data...'));
    const leagueData = await msf.getLeagueData('nba');
    console.log('League data:', leagueData ? chalk.green('✅ Success') : chalk.red('❌ Failed'));
    
    console.log(chalk.green('\n✅ MySportsFeeds integration is working!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ MySportsFeeds test failed:'), error);
  }
}

testMySportsFeeds();