#!/usr/bin/env tsx
/**
 * 🧪 Test MLB Stats Collector with 5 games
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMLBStatsCollector() {
  console.log('🧪 TESTING MLB STATS COLLECTOR (5 games)\n');
  
  // Get 5 test games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, start_time')
    .eq('sport_id', 'mlb')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(5);
  
  if (!games || games.length === 0) {
    console.log('❌ No games found for testing');
    return;
  }
  
  // Get players
  const { data: players } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .eq('sport_id', 'mlb');
  
  const playerLookup = new Map();
  players?.forEach(p => {
    if (p.external_id) {
      playerLookup.set(p.external_id, p);
    }
  });
  
  console.log(`Testing with ${games.length} games and ${playerLookup.size} players...\n`);
  
  let totalStats = 0;
  
  for (const game of games) {
    try {
      if (!game.external_id || !game.external_id.startsWith('espn_mlb_')) {
        console.log(`⏭️  Skipping game ${game.id} (no ESPN ID)`);
        continue;
      }
      
      const gameId = game.external_id.replace('espn_mlb_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
      
      console.log(`🔍 Testing game ${game.id} (ESPN: ${gameId})`);
      
      const response = await axios.get(url, { timeout: 10000 });
      
      if (!response.data.boxscore) {
        console.log(`   ❌ No boxscore data`);
        continue;
      }
      
      let gameStats = 0;
      
      // Count potential stats
      if (response.data.boxscore.teams) {
        for (const team of response.data.boxscore.teams) {
          // Batters
          if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
            for (const athlete of team.statistics[0].athletes) {
              const playerKey = `mlb_${athlete.athlete.id}`;
              if (playerLookup.has(playerKey)) {
                gameStats++;
              }
            }
          }
          
          // Pitchers
          if (team.statistics && team.statistics[1] && team.statistics[1].athletes) {
            for (const athlete of team.statistics[1].athletes) {
              const playerKey = `mlb_${athlete.athlete.id}`;
              if (playerLookup.has(playerKey)) {
                gameStats++;
              }
            }
          }
        }
      }
      
      console.log(`   ✅ Found ${gameStats} potential stats`);
      totalStats += gameStats;
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Test Results:`);
  console.log(`- Games tested: ${games.length}`);
  console.log(`- Total stats found: ${totalStats}`);
  console.log(`- Average per game: ${Math.round(totalStats / games.length)}`);
  
  const estimatedTotal = Math.round((totalStats / games.length) * 5541);
  console.log(`- Estimated for 5,541 games: ${estimatedTotal.toLocaleString()}`);
  
  if (estimatedTotal >= 100000) {
    console.log(`✅ 100K+ target achievable!`);
  }
  
  console.log(`\n🎯 Test completed successfully! Ready for full collection.`);
}

testMLBStatsCollector().catch(console.error);