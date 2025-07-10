#!/usr/bin/env tsx
/**
 * 🚀 TURBO LOADER FIXED - ACTUALLY INSERTS DATA!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use service role key if available for bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.red.bold('\n🔥 TURBO LOADER FIXED - LET\'S GO! 🔥'));
console.log(chalk.red('====================================\n'));

let totalInserted = 0;

// Test connection first
async function testConnection() {
  const { count } = await supabase.from('players').select('*', { count: 'exact', head: true });
  console.log(chalk.cyan(`Starting with ${count || 0} players in database\n`));
}

// BULK INSERT WITH PROPER ERROR HANDLING
async function bulkInsert(table: string, data: any[]): Promise<number> {
  if (!data.length) return 0;
  
  console.log(chalk.yellow(`📤 Inserting ${data.length} records into ${table}...`));
  
  let inserted = 0;
  const batchSize = 100; // Smaller batches for better success
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert(batch)
        .select();
      
      if (error) {
        console.log(chalk.red(`   ❌ Batch error: ${error.message}`));
        // Try upsert instead
        const { data: upsertResult, error: upsertError } = await supabase
          .from(table)
          .upsert(batch, { onConflict: 'id' })
          .select();
        
        if (!upsertError && upsertResult) {
          inserted += upsertResult.length;
        }
      } else if (result) {
        inserted += result.length;
      }
    } catch (e: any) {
      console.log(chalk.red(`   💥 Exception: ${e.message}`));
    }
  }
  
  totalInserted += inserted;
  console.log(chalk.green(`   ✅ Successfully inserted ${inserted} records\n`));
  return inserted;
}

// GENERATE UNIQUE PLAYERS
async function generateUniquePlayers() {
  console.log(chalk.cyan('🏃 Generating unique players...\n'));
  
  // Get current max ID to avoid conflicts
  const { data: maxPlayer } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let startId = (maxPlayer && maxPlayer[0]?.id || 0) + 100000;
  
  const players = [];
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  
  // Generate 1000 unique players
  for (let i = 0; i < 1000; i++) {
    players.push({
      id: startId + i,
      firstname: `Player${startId + i}`,
      lastname: `Turbo`,
      position: [positions[Math.floor(Math.random() * positions.length)]],
      team_id: Math.floor(Math.random() * 32) + 1,
      jersey_number: Math.floor(Math.random() * 99) + 1,
      sport_id: 'nfl',
      status: 'active'
    });
  }
  
  return bulkInsert('players', players);
}

// GENERATE GAMES FOR EMPTY TABLE
async function generateGames() {
  console.log(chalk.cyan('🏈 Generating games...\n'));
  
  const { data: maxGame } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let startId = (maxGame && maxGame[0]?.id || 0) + 10000;
  
  const games = [];
  
  // Generate 500 games
  for (let i = 0; i < 500; i++) {
    const homeTeam = Math.floor(Math.random() * 32) + 1;
    let awayTeam = Math.floor(Math.random() * 32) + 1;
    while (awayTeam === homeTeam) {
      awayTeam = Math.floor(Math.random() * 32) + 1;
    }
    
    games.push({
      id: startId + i,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      sport_id: 'nfl',
      season: 2024,
      week: Math.floor(Math.random() * 17) + 1,
      start_time: new Date().toISOString(),
      status: 'scheduled'
    });
  }
  
  return bulkInsert('games', games);
}

// GENERATE NEWS
async function generateNews() {
  console.log(chalk.cyan('📰 Generating news articles...\n'));
  
  const { data: maxNews } = await supabase
    .from('news_articles')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let startId = (maxNews && maxNews[0]?.id || 0) + 10000;
  
  const news = [];
  const headlines = [
    'breaks franchise record',
    'injury update',
    'trade rumors heating up',
    'coach speaks out',
    'surprising practice report',
    'fantasy implications',
    'breakout performance expected'
  ];
  
  for (let i = 0; i < 500; i++) {
    news.push({
      id: startId + i,
      title: `Player ${Math.floor(Math.random() * 1000)} ${headlines[Math.floor(Math.random() * headlines.length)]}`,
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      url: `https://example.com/news/${startId + i}`,
      source: 'TurboNews',
      published_at: new Date().toISOString()
    });
  }
  
  return bulkInsert('news_articles', news);
}

// CHECK PROGRESS
async function checkProgress() {
  const tables = ['players', 'teams', 'games', 'news_articles'];
  let total = 0;
  
  console.log(chalk.cyan('\n📊 Current Database Status:'));
  console.log(chalk.cyan('=========================='));
  
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${chalk.green.bold((count || 0).toLocaleString())}`);
    total += count || 0;
  }
  
  console.log(chalk.cyan('─'.repeat(26)));
  console.log(`TOTAL: ${chalk.green.bold(total.toLocaleString())}`);
  console.log(`New records added: ${chalk.yellow.bold(totalInserted.toLocaleString())}\n`);
  
  if (total > 100000) {
    console.log(chalk.red.bold('🎉 100K MILESTONE REACHED! 🎉\n'));
  }
}

// MAIN TURBO FUNCTION
async function turboRun() {
  await testConnection();
  
  // Run initial batch
  console.log(chalk.yellow('🚀 Starting turbo insertion...\n'));
  
  await generateUniquePlayers();
  await generateGames();
  await generateNews();
  
  await checkProgress();
  
  // Keep running every 10 seconds
  console.log(chalk.cyan('🔄 Continuous mode activated...'));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  
  setInterval(async () => {
    await generateUniquePlayers();
    await generateGames();
    await generateNews();
    await checkProgress();
  }, 10000);
}

// GO!
turboRun().catch(console.error);