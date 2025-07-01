#!/usr/bin/env tsx
/**
 * 🚀 SUPER LOADER - Loads 1M+ records FAST!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log('\n🚀 SUPER LOADER - LOADING 1 MILLION RECORDS!');
console.log('==========================================\n');

let totalInserted = 0;
const startTime = Date.now();

// Helper to insert in batches
async function batchInsert(table: string, data: any[], batchSize = 1000) {
  if (!data.length) return 0;
  
  console.log(`📤 Inserting ${data.length} records into ${table}...`);
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const { data: result, error } = await supabase
      .from(table)
      .insert(batch)
      .select();
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      // Try smaller batch
      if (batchSize > 100) {
        const smallerInserted = await batchInsert(table, batch, 100);
        inserted += smallerInserted;
      }
    } else if (result) {
      inserted += result.length;
      process.stdout.write('✓');
    }
  }
  
  console.log(`\n✅ Inserted ${inserted} records\n`);
  totalInserted += inserted;
  return inserted;
}

// LOAD PLAYERS
async function loadPlayers() {
  console.log('🏃 Loading 100,000 players...\n');
  
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const firstNames = ['Tom', 'Patrick', 'Josh', 'Lamar', 'Justin', 'Joe', 'Dak', 'Aaron', 'Russell', 'Kirk', 
                      'Derek', 'Matthew', 'Ryan', 'Jared', 'Baker', 'Kyler', 'Trevor', 'Mac', 'Zach', 'Tua'];
  const lastNames = ['Brady', 'Mahomes', 'Allen', 'Jackson', 'Herbert', 'Burrow', 'Prescott', 'Rodgers', 'Wilson', 'Cousins',
                     'Carr', 'Stafford', 'Tannehill', 'Goff', 'Mayfield', 'Murray', 'Lawrence', 'Jones', 'Wilson', 'Tagovailoa'];
  
  const players = [];
  let id = Math.floor(Math.random() * 900000) + 5000000; // Random start to avoid conflicts
  
  // Generate players
  for (let batch = 0; batch < 100; batch++) {
    for (let p = 0; p < 1000; p++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      
      players.push({
        id: id++,
        firstname: firstName,
        lastname: `${lastName}_${batch}_${p}_${timestamp}_${random}`,
        position: [positions[Math.floor(Math.random() * positions.length)]],
        team_id: Math.floor(Math.random() * 32) + 1,
        jersey_number: Math.floor(Math.random() * 99) + 1,
        sport_id: 'nfl',
        status: 'active'
      });
    }
  }
  
  await batchInsert('players', players);
}

// LOAD GAMES
async function loadGames() {
  console.log('🏈 Loading 50,000 games...\n');
  
  const games = [];
  let id = Math.floor(Math.random() * 900000) + 5000000;
  
  // Generate games for multiple seasons
  for (let season = 2020; season <= 2024; season++) {
    for (let week = 1; week <= 18; week++) {
      for (let g = 0; g < 550; g++) {
        const homeTeam = Math.floor(Math.random() * 32) + 1;
        let awayTeam = Math.floor(Math.random() * 32) + 1;
        while (awayTeam === homeTeam) {
          awayTeam = Math.floor(Math.random() * 32) + 1;
        }
        
        const isCompleted = Math.random() > 0.3;
        
        games.push({
          id: id++,
          home_team_id: homeTeam,
          away_team_id: awayTeam,
          sport_id: 'nfl',
          season: season,
          week: week,
          start_time: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: isCompleted ? 'completed' : 'scheduled',
          home_score: isCompleted ? Math.floor(Math.random() * 35) + 10 : null,
          away_score: isCompleted ? Math.floor(Math.random() * 35) + 10 : null
        });
      }
    }
  }
  
  await batchInsert('games', games);
}

// LOAD NEWS
async function loadNews() {
  console.log('📰 Loading 50,000 news articles...\n');
  
  const headlines = [
    'Breaking: Star Player Sets New Career High',
    'Injury Update: Key Player Returns to Practice',
    'Trade Rumors: Team Eyeing Big Move',
    'Fantasy Alert: Waiver Wire Pickup of the Week',
    'Game Preview: Division Rivalry Heats Up',
    'Statistical Analysis: Advanced Metrics Reveal Hidden Value',
    'Coach Speaks: Game Plan for Upcoming Matchup',
    'Rookie Report: First-Year Players Making Impact',
    'Weather Update: Conditions Could Affect Game',
    'Historical Perspective: Record Within Reach'
  ];
  
  const sources = ['ESPN', 'NFL.com', 'Yahoo Sports', 'CBS Sports', 'The Athletic', 
                   'Bleacher Report', 'Pro Football Focus', 'Fantasy Pros', 'Rotoworld', 'NFL Network'];
  
  const news = [];
  let id = Math.floor(Math.random() * 900000) + 5000000;
  
  for (let i = 0; i < 50000; i++) {
    const headline = headlines[Math.floor(Math.random() * headlines.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    
    news.push({
      id: id++,
      title: `${headline} - ${source} Update ${i}`,
      content: `In-depth analysis and breaking news coverage. ${headline}. This comprehensive report provides fantasy managers with crucial information for lineup decisions. Our expert analysis covers player performance, matchup advantages, and strategic insights that could make the difference in your fantasy league...`,
      url: `https://fantasynews.example.com/article/${id}`,
      source: source,
      published_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  await batchInsert('news_articles', news);
}

// SHOW PROGRESS
async function showProgress() {
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(totalInserted / runtime) : 0;
  
  console.log('\n📊 DATABASE STATUS');
  console.log('==================');
  
  // Get current counts
  const tables = ['players', 'teams', 'games', 'news_articles'];
  let grandTotal = 0;
  
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const tableCount = count || 0;
    console.log(`${table}: ${tableCount.toLocaleString()}`);
    grandTotal += tableCount;
  }
  
  console.log('──────────────────');
  console.log(`TOTAL: ${grandTotal.toLocaleString()} records`);
  console.log(`\nInserted this session: ${totalInserted.toLocaleString()}`);
  console.log(`Rate: ${rate} records/sec`);
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  
  if (grandTotal >= 100000) {
    console.log('\n🎉 100K MILESTONE REACHED!');
  }
  if (grandTotal >= 500000) {
    console.log('\n🔥 500K MILESTONE!');
  }
  if (grandTotal >= 1000000) {
    console.log('\n💥💥💥 1 MILLION RECORDS ACHIEVED! 💥💥💥');
  }
  
  return grandTotal;
}

// MAIN
async function main() {
  console.log('✅ Using service role key for unlimited access\n');
  
  // Check initial status
  await showProgress();
  
  // Run initial large batch
  console.log('\n🚀 Starting massive data load...\n');
  
  await Promise.all([
    loadPlayers(),
    loadGames(),
    loadNews()
  ]);
  
  await showProgress();
  
  // Continue loading until 1M
  console.log('\n🔄 Continuing to load data until 1M records...\n');
  
  const interval = setInterval(async () => {
    // Load more data in parallel
    await Promise.all([
      loadPlayers(),
      loadGames(),
      loadNews()
    ]);
    
    const total = await showProgress();
    
    // Stop at 1M
    if (total >= 1000000) {
      clearInterval(interval);
      console.log('\n✅ SUCCESS! Database now contains over 1 MILLION records!');
      console.log('\n🚀 Your Fantasy AI Ultimate platform is ready for massive scale!');
      process.exit(0);
    }
  }, 20000); // Every 20 seconds
}

// Handle shutdown
process.on('SIGINT', async () => {
  await showProgress();
  console.log('\n\n👋 Shutting down...');
  process.exit(0);
});

// GO!
main().catch(console.error);