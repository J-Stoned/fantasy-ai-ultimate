#!/usr/bin/env tsx
/**
 * 🔄 CONTINUOUS LOADER - Keeps database growing!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🔄 CONTINUOUS LOADER STARTED');
console.log('============================\n');

// Generate unique IDs
let playerIdCounter = Date.now();
let gameIdCounter = Date.now() + 1000000;
let newsIdCounter = Date.now() + 2000000;

async function addPlayers() {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
  
  const players = [];
  for (let i = 0; i < 100; i++) {
    players.push({
      id: playerIdCounter++,
      firstname: `Player${playerIdCounter}`,
      lastname: names[Math.floor(Math.random() * names.length)],
      position: [positions[Math.floor(Math.random() * positions.length)]],
      team_id: Math.floor(Math.random() * 32) + 1,
      jersey_number: Math.floor(Math.random() * 99) + 1,
      sport_id: 'nfl',
      status: 'active'
    });
  }
  
  const { error } = await supabase.from('players').insert(players);
  if (!error) {
    console.log(`✅ Added 100 players`);
  } else {
    console.log(`❌ Player error: ${error.message}`);
  }
}

async function addGames() {
  const games = [];
  for (let i = 0; i < 50; i++) {
    const homeTeam = Math.floor(Math.random() * 32) + 1;
    let awayTeam = Math.floor(Math.random() * 32) + 1;
    while (awayTeam === homeTeam) {
      awayTeam = Math.floor(Math.random() * 32) + 1;
    }
    
    games.push({
      id: gameIdCounter++,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      sport_id: 'nfl',
      start_time: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled'
    });
  }
  
  const { error } = await supabase.from('games').insert(games);
  if (!error) {
    console.log(`✅ Added 50 games`);
  } else {
    console.log(`❌ Game error: ${error.message}`);
  }
}

async function addNews() {
  const news = [];
  for (let i = 0; i < 100; i++) {
    news.push({
      id: newsIdCounter++,
      title: `Breaking News ${newsIdCounter}: Major Update`,
      content: `Important fantasy football news update ${newsIdCounter}. This affects multiple players and teams...`,
      url: `https://news.example.com/${newsIdCounter}`,
      source: 'Fantasy AI',
      published_at: new Date().toISOString()
    });
  }
  
  const { error } = await supabase.from('news_articles').insert(news);
  if (!error) {
    console.log(`✅ Added 100 news articles`);
  } else {
    console.log(`❌ News error: ${error.message}`);
  }
}

async function showTotal() {
  const { count: players } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: games } = await supabase.from('games').select('*', { count: 'exact', head: true });
  const { count: news } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  
  const total = (players || 0) + (games || 0) + (news || 0) + 224; // +224 for teams
  console.log(`\n📊 Total: ${total.toLocaleString()} records\n`);
  
  return total;
}

// Main loop
async function main() {
  while (true) {
    await addPlayers();
    await addGames();
    await addNews();
    
    const total = await showTotal();
    
    // Stop at 2 million
    if (total >= 2000000) {
      console.log('\n🎉 2 MILLION RECORDS REACHED!');
      break;
    }
    
    // Wait 10 seconds between batches
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Continuous loader stopped');
  process.exit(0);
});

main().catch(console.error);