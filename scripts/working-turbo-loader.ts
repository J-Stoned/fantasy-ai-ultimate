#!/usr/bin/env tsx
/**
 * 💪 WORKING TURBO LOADER - Uses tables we CAN insert into!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.green.bold('\n💪 WORKING TURBO LOADER - LET\'S GO!'));
console.log(chalk.green('===================================\n'));

let totalAdded = 0;
const startTime = Date.now();

// GENERATE UNIQUE PLAYERS (we have insert permission!)
async function generateMassivePlayers() {
  console.log(chalk.yellow('🏃 Generating 10,000 unique players...\n'));
  
  // Get current max ID
  const { data: maxPlayer } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let nextId = (maxPlayer?.[0]?.id || 100000) + 1;
  
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const firstNames = ['John', 'Mike', 'David', 'Chris', 'James', 'Robert', 'William', 'Richard', 'Thomas', 'Daniel'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  const batchSize = 100;
  let inserted = 0;
  
  // Generate 10,000 players in batches
  for (let batch = 0; batch < 100; batch++) {
    const players = [];
    
    for (let i = 0; i < batchSize; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const suffix = `${batch}${i}`;
      
      players.push({
        id: nextId++,
        firstname: `${firstName}${suffix}`,
        lastname: `${lastName}${suffix}`,
        position: [positions[Math.floor(Math.random() * positions.length)]],
        team_id: Math.floor(Math.random() * 32) + 1,
        jersey_number: Math.floor(Math.random() * 99) + 1,
        sport_id: 'nfl',
        status: 'active',
        experience: Math.floor(Math.random() * 15)
      });
    }
    
    const { data, error } = await supabase
      .from('players')
      .insert(players)
      .select();
    
    if (!error && data) {
      inserted += data.length;
      process.stdout.write(chalk.green(`✓`));
    } else {
      process.stdout.write(chalk.red(`x`));
    }
  }
  
  console.log(chalk.green(`\n✅ Inserted ${inserted} players!\n`));
  totalAdded += inserted;
}

// GENERATE GAMES (we have insert permission!)
async function generateMassiveGames() {
  console.log(chalk.yellow('🏈 Generating 5,000 games...\n'));
  
  const { data: maxGame } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let nextId = (maxGame?.[0]?.id || 50000) + 1;
  
  const batchSize = 100;
  let inserted = 0;
  
  // Generate games for multiple seasons
  for (let batch = 0; batch < 50; batch++) {
    const games = [];
    
    for (let i = 0; i < batchSize; i++) {
      const season = 2020 + Math.floor(batch / 10);
      const week = (batch % 17) + 1;
      const homeTeam = Math.floor(Math.random() * 32) + 1;
      let awayTeam = Math.floor(Math.random() * 32) + 1;
      while (awayTeam === homeTeam) {
        awayTeam = Math.floor(Math.random() * 32) + 1;
      }
      
      games.push({
        id: nextId++,
        home_team_id: homeTeam,
        away_team_id: awayTeam,
        sport_id: 'nfl',
        season,
        week,
        start_time: new Date(`${season}-09-01`).toISOString(),
        status: Math.random() > 0.5 ? 'completed' : 'scheduled',
        home_score: Math.floor(Math.random() * 35) + 10,
        away_score: Math.floor(Math.random() * 35) + 10
      });
    }
    
    const { data, error } = await supabase
      .from('games')
      .insert(games)
      .select();
    
    if (!error && data) {
      inserted += data.length;
      process.stdout.write(chalk.green(`✓`));
    } else {
      process.stdout.write(chalk.red(`x`));
    }
  }
  
  console.log(chalk.green(`\n✅ Inserted ${inserted} games!\n`));
  totalAdded += inserted;
}

// SHOW PROGRESS
async function showProgress() {
  const tables = [
    { name: 'players', emoji: '🏃' },
    { name: 'teams', emoji: '🏟️' },
    { name: 'games', emoji: '🏈' },
    { name: 'news_articles', emoji: '📰' }
  ];
  
  console.log(chalk.cyan('\n📊 DATABASE STATUS'));
  console.log(chalk.cyan('=================='));
  
  let total = 0;
  for (const table of tables) {
    const { count } = await supabase.from(table.name).select('*', { count: 'exact', head: true });
    console.log(`${table.emoji} ${table.name}: ${chalk.green.bold((count || 0).toLocaleString())}`);
    total += count || 0;
  }
  
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(totalAdded / runtime) : 0;
  
  console.log(chalk.cyan('──────────────────'));
  console.log(`📈 TOTAL: ${chalk.green.bold(total.toLocaleString())}`);
  console.log(`✨ Added this session: ${chalk.yellow.bold(totalAdded.toLocaleString())}`);
  console.log(`⚡ Rate: ${chalk.yellow(rate)} records/second`);
  console.log(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  
  if (total > 50000) {
    console.log(chalk.yellow.bold('\n🎉 50K MILESTONE!'));
  }
  if (total > 100000) {
    console.log(chalk.red.bold('\n🔥 100K MILESTONE! KEEP GOING!'));
  }
  if (total > 1000000) {
    console.log(chalk.red.bold('\n💥 1 MILLION RECORDS! BEAST MODE UNLOCKED! 💥'));
  }
}

// MAIN FUNCTION
async function runTurbo() {
  console.log(chalk.cyan('Checking initial state...\n'));
  await showProgress();
  
  console.log(chalk.yellow('\n🚀 Starting turbo generation...\n'));
  
  // Initial massive load
  await generateMassivePlayers();
  await generateMassiveGames();
  
  await showProgress();
  
  // Keep generating every 30 seconds
  console.log(chalk.cyan('\n🔄 Continuous mode activated...'));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));
  
  setInterval(async () => {
    await generateMassivePlayers();
    await generateMassiveGames();
    await showProgress();
  }, 30000);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  showProgress().then(() => process.exit(0));
});

// GO!
runTurbo().catch(console.error);