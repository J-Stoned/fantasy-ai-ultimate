#!/usr/bin/env tsx
/**
 * Debug batch data processing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBatchData() {
  console.log(chalk.blue('\n=== BATCH DATA DEBUGGING ===\n'));
  
  // 1. Check games that should have stats
  const { data: gamesToProcess } = await supabase
    .from('games')
    .select('id, external_id, sport_id, start_time')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(100);
  
  if (!gamesToProcess) {
    console.log('No games found');
    return;
  }
  
  // 2. Check which ones have stats
  const gameIds = gamesToProcess.map(g => g.id);
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', gameIds);
  
  const processedIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
  const unprocessedGames = gamesToProcess.filter(g => !processedIds.has(g.id));
  
  console.log(chalk.cyan(`Out of ${gamesToProcess.length} recent games:`));
  console.log(chalk.green(`  ✓ ${processedIds.size} have stats`));
  console.log(chalk.yellow(`  ⚠️  ${unprocessedGames.length} missing stats`));
  
  // 3. Analyze unprocessed games by sport
  const bySport = unprocessedGames.reduce((acc, game) => {
    acc[game.sport_id] = (acc[game.sport_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(chalk.cyan('\nUnprocessed games by sport:'));
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} games`);
  });
  
  // 4. Check if there's a pattern in external_ids
  console.log(chalk.cyan('\nSample unprocessed games:'));
  unprocessedGames.slice(0, 5).forEach(game => {
    const date = new Date(game.start_time).toLocaleDateString();
    console.log(`  Game ${game.id}: ${game.external_id} (${game.sport_id}, ${date})`);
  });
  
  // 5. Try to fetch data for one unprocessed game
  if (unprocessedGames.length > 0) {
    const testGame = unprocessedGames[0];
    console.log(chalk.cyan(`\nTesting ESPN API for game ${testGame.id} (${testGame.external_id})...`));
    
    // Extract ESPN ID
    const match = testGame.external_id.match(/(\d+)$/);
    if (match) {
      const espnId = match[1];
      const sportMap: Record<string, string> = {
        nfl: 'football/nfl',
        nba: 'basketball/nba',
        mlb: 'baseball/mlb',
        nhl: 'hockey/nhl'
      };
      
      const sportPath = sportMap[testGame.sport_id] || testGame.sport_id;
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${espnId}`;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log(chalk.green('✓ API returned data'));
          console.log('  Has boxscore:', !!data.boxscore);
          console.log('  Has players:', !!data.boxscore?.players);
          if (data.boxscore?.players) {
            console.log('  Player arrays:', data.boxscore.players.length);
          }
        } else {
          console.log(chalk.red(`✗ API error: ${response.status} ${response.statusText}`));
        }
      } catch (error) {
        console.log(chalk.red('✗ Network error:', error));
      }
    }
  }
  
  // 6. Check processing rate
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('game_id, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  if (recentStats && recentStats.length > 0) {
    const uniqueRecentGames = new Set(recentStats.map(s => s.game_id));
    const firstTime = new Date(recentStats[recentStats.length - 1].created_at).getTime();
    const lastTime = new Date(recentStats[0].created_at).getTime();
    const duration = (lastTime - firstTime) / 1000 / 60; // minutes
    
    console.log(chalk.cyan('\nProcessing rate:'));
    console.log(`  Games processed in last hour: ${uniqueRecentGames.size}`);
    console.log(`  Stats inserted: ${recentStats.length}`);
    if (duration > 0) {
      console.log(`  Rate: ${(uniqueRecentGames.size / duration * 60).toFixed(1)} games/hour`);
    }
  }
}

debugBatchData().catch(console.error);