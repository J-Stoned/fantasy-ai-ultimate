#!/usr/bin/env tsx
/**
 * SIMPLE DATA COLLECTOR - Direct Supabase Collection
 * Bypasses complex imports for immediate data collection
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log('🚀 FANTASY AI ULTIMATE - SIMPLE DATA COLLECTOR');
console.log('===========================================\n');

// Test connection
async function testConnection() {
  const { data, error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\nMake sure to:');
    console.log('1. Run migrations in Supabase SQL Editor');
    console.log('2. Enable RLS on tables or disable it for testing');
    return false;
  }
  console.log('✅ Database connected successfully!\n');
  return true;
}

// Collect sports news
async function collectSportsNews() {
  console.log('📰 Collecting sports news...');
  
  try {
    // Using free sports news from ESPN RSS (no API key needed)
    const rssUrl = 'https://www.espn.com/espn/rss/nfl/news';
    const response = await axios.get(rssUrl);
    
    // Simple RSS parsing (in production use a proper RSS parser)
    const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
    let newsCount = 0;
    
    for (const item of items.slice(0, 5)) { // Get first 5 items
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      
      if (title && link) {
        const { error } = await supabase.from('news_articles').upsert({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
          url: link,
          source: 'ESPN',
          sport_id: 'nfl',
          published_at: new Date(pubDate).toISOString(),
          content: 'Click to read full article'
        }, {
          onConflict: 'url'
        });
        
        if (!error) newsCount++;
      }
    }
    
    console.log(`✅ Collected ${newsCount} news articles\n`);
  } catch (error) {
    console.error('❌ News collection failed:', error.message);
  }
}

// Collect player data from free API
async function collectPlayerData() {
  console.log('🏈 Collecting player data...');
  
  try {
    // Using the free balldontlie API for NBA players
    const response = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=10');
    const players = response.data.data;
    let playerCount = 0;
    
    for (const player of players) {
      const { error } = await supabase.from('players').upsert({
        firstName: player.first_name,
        lastName: player.last_name,
        position: player.position ? [player.position] : ['Unknown'],
        heightInches: player.height_feet ? (player.height_feet * 12) + (player.height_inches || 0) : null,
        weightLbs: player.weight_pounds,
        status: 'active',
        sport_id: 'nba'
      }, {
        onConflict: 'firstName,lastName'
      });
      
      if (!error) playerCount++;
    }
    
    console.log(`✅ Collected ${playerCount} NBA players\n`);
  } catch (error) {
    console.error('❌ Player collection failed:', error.message);
  }
}

// Main function
async function startDataCollection() {
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  // Run once on startup
  console.log('🏁 Running initial data collection...\n');
  await collectSportsNews();
  await collectPlayerData();
  
  // Schedule regular collections
  console.log('📅 Scheduling regular collections...\n');
  
  // Collect news every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Running scheduled collection...`);
    collectSportsNews();
  });
  
  // Collect player data every hour
  cron.schedule('0 * * * *', () => {
    console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Updating player data...`);
    collectPlayerData();
  });
  
  // Health check every minute
  cron.schedule('* * * * *', () => {
    const uptime = Math.floor(process.uptime() / 60);
    const memory = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(`💚 Health Check - Uptime: ${uptime}m, Memory: ${memory}MB`);
  });
  
  console.log('✅ DATA COLLECTION ACTIVE!');
  console.log('=====================================');
  console.log('📰 News: Every 15 minutes');
  console.log('🏈 Players: Every hour');
  console.log('💚 Health: Every minute');
  console.log('\nPress Ctrl+C to stop\n');
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down data collection...');
  process.exit(0);
});

// Start collection
startDataCollection().catch(console.error);