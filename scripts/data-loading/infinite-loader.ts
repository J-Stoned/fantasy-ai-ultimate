#!/usr/bin/env tsx
/**
 * ♾️ INFINITE LOADER - Can run forever with new ID strategy!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('♾️  INFINITE LOADER STARTED');
console.log('==========================\n');
console.log('✅ Using auto-increment IDs - no more overflow!');
console.log('📈 Will run continuously until stopped\n');

let sessionInserted = 0;
const startTime = Date.now();

// Player name variations
const firstNames = ['Tom', 'Patrick', 'Josh', 'Lamar', 'Justin', 'Joe', 'Dak', 'Aaron', 'Russell', 'Kirk',
                    'Derek', 'Matthew', 'Ryan', 'Jared', 'Baker', 'Kyler', 'Trevor', 'Mac', 'Zach', 'Tua',
                    'Jalen', 'Daniel', 'Sam', 'Jimmy', 'Carson', 'Davis', 'Tyler', 'Cooper', 'Jacoby', 'Andy',
                    'Marcus', 'Deshaun', 'Geno', 'Kenny', 'Jordan', 'Bailey', 'Will', 'Malik', 'Drew', 'Teddy'];
                    
const lastNames = ['Brady', 'Mahomes', 'Allen', 'Jackson', 'Herbert', 'Burrow', 'Prescott', 'Rodgers', 'Wilson', 'Cousins',
                   'Carr', 'Stafford', 'Tannehill', 'Goff', 'Mayfield', 'Murray', 'Lawrence', 'Jones', 'Tagovailoa', 'Hurts',
                   'Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson',
                   'Thomas', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Young'];

async function addPlayers(count: number = 500) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  
  const players = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    players.push({
      // No ID needed - database will auto-generate!
      firstname: firstName,
      lastname: `${lastName}_${timestamp}_${random}`,
      position: [positions[Math.floor(Math.random() * positions.length)]],
      team_id: Math.floor(Math.random() * 32) + 1,
      jersey_number: Math.floor(Math.random() * 99) + 1,
      sport_id: 'nfl',
      status: Math.random() > 0.1 ? 'active' : 'injured'
    });
  }
  
  const { data, error } = await supabase.from('players').insert(players).select();
  if (error) {
    console.log(`❌ Player error: ${error.message}`);
    return 0;
  }
  return data?.length || 0;
}

async function addGames(count: number = 250) {
  const games = [];
  
  for (let i = 0; i < count; i++) {
    const homeTeam = Math.floor(Math.random() * 32) + 1;
    let awayTeam = Math.floor(Math.random() * 32) + 1;
    while (awayTeam === homeTeam) {
      awayTeam = Math.floor(Math.random() * 32) + 1;
    }
    
    const isCompleted = Math.random() > 0.4;
    const gameDate = new Date(Date.now() + (Math.random() - 0.5) * 365 * 24 * 60 * 60 * 1000);
    
    games.push({
      // No ID needed - database will auto-generate!
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      sport_id: 'nfl',
      start_time: gameDate.toISOString(),
      status: isCompleted ? 'completed' : 'scheduled',
      home_score: isCompleted ? Math.floor(Math.random() * 35) + 10 : null,
      away_score: isCompleted ? Math.floor(Math.random() * 35) + 10 : null
    });
  }
  
  const { data, error } = await supabase.from('games').insert(games).select();
  if (error) {
    console.log(`❌ Game error: ${error.message}`);
    return 0;
  }
  return data?.length || 0;
}

async function addNews(count: number = 500) {
  const headlines = [
    '{player} sets new career high with {number} {stat}',
    'Breaking: {team} signs {position} to {years}-year deal',
    'Injury Update: {player} {status} for Week {week}',
    'Fantasy Alert: Start {player} against {team} defense',
    'Trade Rumors: {team1} interested in {team2} star {position}',
    'Coach confirms {player} will see increased {role}',
    'Weather Alert: {condition} expected for {team1} @ {team2}',
    'DFS Value: {player} priced at ${salary} on {platform}',
    'Betting: {team} favored by {points} against {opponent}',
    'Rookie {player} continues to impress in {situation}'
  ];
  
  const sources = ['ESPN', 'NFL.com', 'Yahoo Sports', 'CBS Sports', 'The Athletic',
                   'Bleacher Report', 'Pro Football Focus', 'Fantasy Pros', 'Rotoworld',
                   'NFL Network', 'FOX Sports', 'NBC Sports', 'SI.com', 'USA Today'];
  
  const news = [];
  for (let i = 0; i < count; i++) {
    const headline = headlines[Math.floor(Math.random() * headlines.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const timestamp = Date.now();
    const articleId = Math.random().toString(36).substring(2, 9);
    
    news.push({
      // No ID needed - database will auto-generate!
      title: `${headline} - ${source} (${articleId})`,
      content: `Comprehensive fantasy football analysis. ${headline}. Our expert team provides detailed insights into how this impacts your fantasy lineup decisions. Including advanced metrics, historical context, and projections for the upcoming matchups. This report covers both season-long and DFS implications...`,
      url: `https://fantasy-news.ai/${timestamp}/${articleId}`,
      source: source,
      published_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  const { data, error } = await supabase.from('news_articles').insert(news).select();
  if (error) {
    console.log(`❌ News error: ${error.message}`);
    return 0;
  }
  return data?.length || 0;
}

async function showProgress() {
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(sessionInserted / runtime) : 0;
  
  // Get current counts
  const { count: players } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: games } = await supabase.from('games').select('*', { count: 'exact', head: true });
  const { count: news } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  const { count: teams } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  
  const total = (players || 0) + (games || 0) + (news || 0) + (teams || 0);
  
  console.log('\n📊 DATABASE STATUS');
  console.log('==================');
  console.log(`Players: ${(players || 0).toLocaleString()}`);
  console.log(`Games: ${(games || 0).toLocaleString()}`);
  console.log(`News: ${(news || 0).toLocaleString()}`);
  console.log(`Teams: ${(teams || 0).toLocaleString()}`);
  console.log('──────────────────');
  console.log(`TOTAL: ${total.toLocaleString()} records`);
  console.log(`\nSession: +${sessionInserted.toLocaleString()} records`);
  console.log(`Rate: ${rate.toLocaleString()} records/sec`);
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  
  // Milestones
  if (total >= 2000000 && total < 2001000) {
    console.log('\n🎉🎉 2 MILLION RECORDS! 🎉🎉');
  } else if (total >= 5000000 && total < 5001000) {
    console.log('\n🚀🚀 5 MILLION RECORDS! 🚀🚀');
  } else if (total >= 10000000 && total < 10001000) {
    console.log('\n💥💥 10 MILLION RECORDS! 💥💥');
  }
  
  return total;
}

// Main loop
async function main() {
  console.log('Starting continuous data generation...\n');
  
  let batchCount = 0;
  
  while (true) {
    batchCount++;
    console.log(`\n🔄 Batch #${batchCount} starting...`);
    
    // Add data in parallel
    const [playersAdded, gamesAdded, newsAdded] = await Promise.all([
      addPlayers(500),
      addGames(250),
      addNews(500)
    ]);
    
    const batchTotal = playersAdded + gamesAdded + newsAdded;
    sessionInserted += batchTotal;
    
    console.log(`✅ Batch complete: +${batchTotal.toLocaleString()} records`);
    
    // Show progress every 5 batches
    if (batchCount % 5 === 0) {
      await showProgress();
    }
    
    // Wait 5 seconds between batches
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Stopping infinite loader...');
  await showProgress();
  console.log('\n👋 Infinite loader stopped');
  process.exit(0);
});

// Start the infinite loader
main().catch(console.error);