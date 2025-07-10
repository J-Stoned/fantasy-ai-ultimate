#!/usr/bin/env tsx
/**
 * 🧠 SMART TURBO LOADER - Works with current permissions!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.red.bold('\n🧠 SMART TURBO LOADER'));
console.log(chalk.red('======================\n'));

// First, let's see what we CAN do
async function checkPermissions() {
  console.log(chalk.cyan('🔍 Checking permissions...\n'));
  
  const tables = ['players', 'teams', 'games', 'news_articles'];
  const permissions: any = {};
  
  for (const table of tables) {
    permissions[table] = { read: false, insert: false };
    
    // Check read
    const { error: readError } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    permissions[table].read = !readError;
    
    // Check insert with minimal data
    const testData = { id: 999999999 };
    const { error: insertError } = await supabase
      .from(table)
      .insert([testData]);
    
    if (!insertError) {
      permissions[table].insert = true;
      // Clean up
      await supabase.from(table).delete().eq('id', 999999999);
    }
    
    console.log(`${table}: ${permissions[table].read ? '✅ Read' : '❌ Read'} | ${permissions[table].insert ? '✅ Insert' : '❌ Insert'}`);
  }
  
  return permissions;
}

// Load data from external APIs that don't need auth
async function loadFromFreeAPIs() {
  console.log(chalk.cyan('\n🌐 Loading from free APIs...\n'));
  
  try {
    // ESPN RSS - Always free!
    console.log(chalk.yellow('📰 Loading ESPN news...'));
    const rssUrl = 'https://www.espn.com/espn/rss/nfl/news';
    const response = await fetch(rssUrl);
    const text = await response.text();
    
    // Parse RSS items
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    const news = [];
    
    for (let i = 0; i < Math.min(items.length, 20); i++) {
      const item = items[i];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      
      if (title && link) {
        news.push({
          title: title.slice(0, 200),
          url: link,
          source: 'ESPN RSS',
          published_at: new Date(pubDate).toISOString(),
          content: 'Click link for full article'
        });
      }
    }
    
    if (news.length > 0) {
      const { data, error } = await supabase
        .from('news_articles')
        .upsert(news, { onConflict: 'url' })
        .select();
      
      if (!error && data) {
        console.log(chalk.green(`✅ Loaded ${data.length} ESPN articles`));
      } else {
        console.log(chalk.red(`❌ Failed to insert news: ${error?.message}`));
      }
    }
  } catch (e: any) {
    console.log(chalk.red(`❌ ESPN error: ${e.message}`));
  }
  
  // Try other free sources
  console.log(chalk.yellow('\n🏈 Loading more data...'));
  
  // CBS Sports RSS
  try {
    const cbsUrl = 'https://www.cbssports.com/rss/headlines/nfl/';
    const response = await fetch(cbsUrl);
    const text = await response.text();
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    console.log(chalk.green(`✅ Found ${items.length} CBS Sports articles`));
  } catch (e) {
    console.log(chalk.gray('CBS Sports not available'));
  }
}

// Use what we have access to
async function smartLoad() {
  // Check current data
  const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: newsCount } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  
  console.log(chalk.cyan('\n📊 Current Status:'));
  console.log(`Players: ${playerCount || 0}`);
  console.log(`News: ${newsCount || 0}\n`);
  
  // Load from free sources
  await loadFromFreeAPIs();
  
  // Show instructions
  console.log(chalk.yellow('\n💡 TO SPEED UP DATA COLLECTION:\n'));
  console.log('1. Get your Supabase SERVICE ROLE KEY:');
  console.log('   - Go to: https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup/settings/api');
  console.log('   - Copy the "service_role" key (starts with eyJ...)');
  console.log('   - Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your-key-here\n');
  
  console.log('2. OR disable RLS temporarily:');
  console.log('   - Go to Supabase SQL Editor');
  console.log('   - Run: ALTER TABLE players DISABLE ROW LEVEL SECURITY;');
  console.log('   - Run: ALTER TABLE teams DISABLE ROW LEVEL SECURITY;');
  console.log('   - Run: ALTER TABLE games DISABLE ROW LEVEL SECURITY;');
  console.log('   - Run: ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;\n');
  
  console.log('3. Add FREE API keys to .env.local:');
  console.log('   - OpenWeather: https://openweathermap.org/api (free)');
  console.log('   - The Odds API: https://the-odds-api.com (free tier)');
  console.log('   - NewsAPI: https://newsapi.org (free tier)\n');
}

// Check and load
async function main() {
  const perms = await checkPermissions();
  
  const canInsertAnything = Object.values(perms).some((p: any) => p.insert);
  
  if (!canInsertAnything) {
    console.log(chalk.red('\n❌ Cannot insert into any tables with current credentials!'));
    console.log(chalk.yellow('This is likely due to Row Level Security (RLS) policies.\n'));
  }
  
  await smartLoad();
  
  // Keep trying every 30 seconds
  setInterval(async () => {
    console.log(chalk.gray('\n🔄 Checking for new data...'));
    await loadFromFreeAPIs();
  }, 30000);
}

main().catch(console.error);

console.log(chalk.gray('\nPress Ctrl+C to stop\n'));