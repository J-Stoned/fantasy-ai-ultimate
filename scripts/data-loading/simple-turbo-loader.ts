#!/usr/bin/env tsx
/**
 * 🚀 SIMPLE TURBO LOADER - Works with existing columns!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.green.bold('\n🚀 SIMPLE TURBO LOADER'));
console.log(chalk.green('======================\n'));

let totalInserted = 0;
const startTime = Date.now();

// Helper to insert in batches
async function batchInsert(table: string, data: any[], batchSize = 500) {
  if (!data.length) return 0;
  
  console.log(chalk.yellow(`📤 Inserting ${data.length} records into ${table}...`));
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const { data: result, error } = await supabase
      .from(table)
      .insert(batch)
      .select();
    
    if (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      // Try smaller batch
      if (batchSize > 50) {
        const smallerInserted = await batchInsert(table, batch, 50);
        inserted += smallerInserted;
      }
    } else if (result) {
      inserted += result.length;
      process.stdout.write(chalk.green('✓'));
    }
  }
  
  console.log(chalk.green(`\n✅ Inserted ${inserted} records\n`));
  totalInserted += inserted;
  return inserted;
}

// LOAD PLAYERS
async function loadPlayers() {
  console.log(chalk.cyan('🏃 Loading 10,000 players...\n'));
  
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const firstNames = ['Tom', 'Patrick', 'Josh', 'Lamar', 'Justin', 'Joe', 'Dak', 'Aaron', 'Russell', 'Kirk'];
  const lastNames = ['Brady', 'Mahomes', 'Allen', 'Jackson', 'Herbert', 'Burrow', 'Prescott', 'Rodgers', 'Wilson', 'Cousins'];
  
  const players = [];
  let id = 3000000; // Start at 3M to avoid conflicts
  
  // Generate players
  for (let team = 1; team <= 32; team++) {
    for (let p = 0; p < 300; p++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const uniqueSuffix = `${team}_${p}`;
      
      players.push({
        id: id++,
        firstname: firstName,
        lastname: `${lastName}_${uniqueSuffix}`,
        position: [positions[Math.floor(Math.random() * positions.length)]],
        team_id: team,
        jersey_number: Math.floor(Math.random() * 99) + 1,
        sport_id: 'nfl',
        status: 'active',
        experience: Math.floor(Math.random() * 15)
      });
    }
  }
  
  await batchInsert('players', players);
}

// LOAD TEAMS
async function loadTeams() {
  console.log(chalk.cyan('🏟️ Loading NFL teams...\n'));
  
  const nflTeams = [
    { id: 101, name: 'Cardinals', city: 'Arizona', abbreviation: 'ARI' },
    { id: 102, name: 'Falcons', city: 'Atlanta', abbreviation: 'ATL' },
    { id: 103, name: 'Ravens', city: 'Baltimore', abbreviation: 'BAL' },
    { id: 104, name: 'Bills', city: 'Buffalo', abbreviation: 'BUF' },
    { id: 105, name: 'Panthers', city: 'Carolina', abbreviation: 'CAR' },
    { id: 106, name: 'Bears', city: 'Chicago', abbreviation: 'CHI' },
    { id: 107, name: 'Bengals', city: 'Cincinnati', abbreviation: 'CIN' },
    { id: 108, name: 'Browns', city: 'Cleveland', abbreviation: 'CLE' },
    { id: 109, name: 'Cowboys', city: 'Dallas', abbreviation: 'DAL' },
    { id: 110, name: 'Broncos', city: 'Denver', abbreviation: 'DEN' },
    { id: 111, name: 'Lions', city: 'Detroit', abbreviation: 'DET' },
    { id: 112, name: 'Packers', city: 'Green Bay', abbreviation: 'GB' },
    { id: 113, name: 'Texans', city: 'Houston', abbreviation: 'HOU' },
    { id: 114, name: 'Colts', city: 'Indianapolis', abbreviation: 'IND' },
    { id: 115, name: 'Jaguars', city: 'Jacksonville', abbreviation: 'JAX' },
    { id: 116, name: 'Chiefs', city: 'Kansas City', abbreviation: 'KC' }
  ];
  
  const teams = nflTeams.map(team => ({
    ...team,
    sport_id: 'nfl',
    league_id: 'nfl'
  }));
  
  await batchInsert('teams', teams);
}

// LOAD GAMES
async function loadGames() {
  console.log(chalk.cyan('🏈 Loading 5,000 games...\n'));
  
  const games = [];
  let id = 3000000;
  
  // Generate games
  for (let i = 0; i < 5000; i++) {
    const homeTeam = Math.floor(Math.random() * 32) + 1;
    let awayTeam = Math.floor(Math.random() * 32) + 1;
    while (awayTeam === homeTeam) {
      awayTeam = Math.floor(Math.random() * 32) + 1;
    }
    
    games.push({
      id: id++,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      sport_id: 'nfl',
      start_time: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: Math.random() > 0.5 ? 'scheduled' : 'completed',
      home_score: Math.random() > 0.5 ? Math.floor(Math.random() * 35) + 10 : null,
      away_score: Math.random() > 0.5 ? Math.floor(Math.random() * 35) + 10 : null
    });
  }
  
  await batchInsert('games', games);
}

// LOAD NEWS
async function loadNews() {
  console.log(chalk.cyan('📰 Loading 5,000 news articles...\n'));
  
  const headlines = [
    'Player returns to practice',
    'Coach discusses game plan',
    'Injury update: day-to-day',
    'Team makes roster move',
    'Player sets new record',
    'Trade deadline approaching',
    'Fantasy impact analysis',
    'Weather could affect game',
    'Player of the week announced',
    'Rookie making waves'
  ];
  
  const news = [];
  let id = 3000000;
  
  for (let i = 0; i < 5000; i++) {
    const headline = headlines[Math.floor(Math.random() * headlines.length)];
    
    news.push({
      id: id++,
      title: `${headline} - Update ${i}`,
      content: `This is a news article about ${headline}. More details to follow...`,
      url: `https://example.com/news/${id}`,
      source: ['ESPN', 'NFL.com', 'Yahoo', 'CBS'][Math.floor(Math.random() * 4)],
      published_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  await batchInsert('news_articles', news);
}

// SHOW PROGRESS
async function showProgress() {
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(totalInserted / runtime) : 0;
  
  console.log(chalk.cyan('\n📊 TURBO LOADER PROGRESS'));
  console.log(chalk.cyan('========================'));
  
  // Get current counts
  const tables = ['players', 'teams', 'games', 'news_articles'];
  let grandTotal = 0;
  
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${chalk.green.bold((count || 0).toLocaleString())}`);
    grandTotal += count || 0;
  }
  
  console.log(chalk.cyan('────────────────────────'));
  console.log(`TOTAL: ${chalk.green.bold(grandTotal.toLocaleString())}`);
  console.log(`\nInserted this session: ${chalk.yellow(totalInserted.toLocaleString())}`);
  console.log(`Rate: ${chalk.yellow(rate)} records/sec`);
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  
  if (grandTotal >= 100000) {
    console.log(chalk.green.bold('\n🎉 100K MILESTONE REACHED!'));
  }
  if (grandTotal >= 500000) {
    console.log(chalk.yellow.bold('\n🔥 500K MILESTONE!'));
  }
  if (grandTotal >= 1000000) {
    console.log(chalk.red.bold('\n💥 1 MILLION RECORDS ACHIEVED! 💥'));
  }
}

// MAIN
async function main() {
  console.log(chalk.green('✅ Using service role key\n'));
  
  // Initial load
  await loadTeams();
  await loadPlayers();
  await loadGames();
  await loadNews();
  
  await showProgress();
  
  // Continue loading
  console.log(chalk.yellow('\n🔄 Continuing to load more data...\n'));
  
  const interval = setInterval(async () => {
    await Promise.all([
      loadPlayers(),
      loadGames(),
      loadNews()
    ]);
    
    await showProgress();
  }, 30000); // Every 30 seconds
  
  // Stop at 1M
  setTimeout(async () => {
    clearInterval(interval);
    await showProgress();
    console.log(chalk.green.bold('\n✅ Loading complete!'));
    process.exit(0);
  }, 600000); // 10 minutes max
}

// Handle shutdown
process.on('SIGINT', async () => {
  await showProgress();
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  process.exit(0);
});

// GO!
main().catch(console.error);