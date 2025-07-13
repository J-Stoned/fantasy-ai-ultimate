#!/usr/bin/env tsx
/**
 * Test 2024 NFL games that should have data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test2024NFLGames() {
  console.log(chalk.bold.cyan('\n🧪 TESTING 2024 NFL GAMES\n'));

  try {
    // Get 2024 NFL games without stats
    const { data: games2024 } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)  // Exclude 0-0 games
      .neq('away_score', 0)
      .limit(5)
      .order('start_time', { ascending: false });
    
    console.log(`Found ${games2024?.length || 0} 2024 NFL games to test`);
    
    // Check which don't have stats
    const { data: gameLogsIds } = await supabase
      .from('player_game_logs')
      .select('game_id');
    
    const gamesWithStats = new Set(gameLogsIds?.map(l => l.game_id) || []);
    
    for (const game of (games2024 || [])) {
      console.log(chalk.yellow(`\nTesting game ID: ${game.id}`));
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Date: ${game.start_time?.split('T')[0]}`);
      console.log(`  Score: ${game.home_score} - ${game.away_score}`);
      console.log(`  Has stats: ${gamesWithStats.has(game.id) ? 'YES' : 'NO'}`);
      
      // Test ESPN API call if no stats
      if (!gamesWithStats.has(game.id) && game.external_id) {
        const espnId = game.external_id.replace(/^(?:espn_)?(?:nfl_)?/, '');
        console.log(`  ESPN ID: ${espnId}`);
        
        try {
          const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
            {
              params: { event: espnId },
              timeout: 10000
            }
          );
          
          console.log(chalk.green(`  ✅ ESPN API: ${response.status}`));
          
          // Check boxscore data
          const boxscore = response.data.boxscore;
          if (boxscore && boxscore.players) {
            let totalPlayers = 0;
            
            boxscore.players.forEach((team: any) => {
              team.statistics?.forEach((category: any) => {
                totalPlayers += category.athletes?.length || 0;
              });
            });
            
            console.log(`  Players in ESPN: ${totalPlayers}`);
            
            if (totalPlayers > 0) {
              console.log(chalk.green(`  ✅ This game SHOULD have been processed!`));
            } else {
              console.log(chalk.yellow(`  ⚠️ ESPN has no player data`));
            }
          } else {
            console.log(chalk.yellow(`  ⚠️ No boxscore in ESPN response`));
          }
          
        } catch (apiError: any) {
          console.log(chalk.red(`  ❌ ESPN API Error: ${apiError.response?.status || apiError.message}`));
        }
      }
    }
    
    // Summary of filtering issues
    console.log(chalk.bold.cyan('\n📊 FILTERING ANALYSIS:'));
    
    // Count games by type
    const { count: total2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01');
    
    const { count: completed2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0);
    
    const { count: future } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gt('start_time', new Date().toISOString());
    
    const { count: zeroScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .or('home_score.eq.0,away_score.eq.0');
    
    console.log(`Total 2024 NFL games: ${total2024}`);
    console.log(`Completed 2024 games: ${completed2024}`);
    console.log(`Future games: ${future}`);
    console.log(`Games with 0-0 scores: ${zeroScores}`);
    
    const shouldProcess = (completed2024 || 0);
    const currentProcessed = Array.from(gamesWithStats).filter(id => {
      // This is approximate - would need to join to check
      return true;
    }).length;
    
    console.log(chalk.bold.yellow(`\n🎯 REAL TARGET:`));
    console.log(`Should process: ${shouldProcess} games (2024 completed only)`);
    console.log(`Currently processed: ${currentProcessed} total (all years)`);

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

test2024NFLGames();