#!/usr/bin/env tsx
/**
 * Debug which games are being processed
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugWhichGames() {
  console.log(chalk.bold.cyan('\n🔍 DEBUGGING WHICH GAMES ARE PROCESSED\n'));
  
  // Get games without stats (same logic as small batch test)
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
    
  const processedGameIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(50);
    
  const gamesToProcess = (allGames || []).filter(game => 
    !processedGameIds.has(game.id) && game.external_id
  ).slice(0, 5);
  
  console.log(chalk.yellow('Games that would be processed:'));
  gamesToProcess.forEach((game, i) => {
    console.log(chalk.white(`${i+1}. Game ${game.id}: ${game.external_id} (${game.start_time})`));
  });
  
  // Test the first game's external_id format
  if (gamesToProcess.length > 0) {
    const firstGame = gamesToProcess[0];
    const match = firstGame.external_id.match(/(\d{9,})/);
    const espnId = match ? match[1] : null;
    
    console.log(chalk.cyan('\nFirst game ESPN ID extraction:'));
    console.log('External ID:', firstGame.external_id);
    console.log('Extracted ESPN ID:', espnId);
    
    if (espnId) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`;
      console.log('ESPN URL:', url);
      
      // Quick test fetch
      try {
        const axios = await import('axios');
        const response = await axios.default.get(url);
        console.log(chalk.green('✓ ESPN API responds'));
        console.log('Has boxscore?', !!response.data.boxscore);
        console.log('Players array length:', response.data.boxscore?.players?.length || 0);
        
        if (response.data.boxscore?.players?.length > 0) {
          console.log('Team 1 stats:', response.data.boxscore.players[0].statistics?.length || 0);
        }
      } catch (error: any) {
        console.error(chalk.red('❌ ESPN API error:'), error.message);
      }
    }
  }
}

debugWhichGames().catch(console.error);