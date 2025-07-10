#!/usr/bin/env tsx
/**
 * Fix the 66 NFL games - with better monitoring and error handling
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runFix() {
  console.log(chalk.bold.cyan('\n🔧 FIXING REMAINING NFL GAMES\n'));
  
  try {
    // 1. Get games without stats RIGHT NOW
    console.log(chalk.yellow('Finding games without stats...'));
    
    const { data: all2024Games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .order('start_time');
    
    if (!all2024Games) {
      console.error('No games found');
      return;
    }
    
    // Find games without stats
    const gamesWithoutStats = [];
    for (const game of all2024Games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (!count || count === 0) {
        gamesWithoutStats.push(game);
      }
    }
    
    console.log(chalk.yellow(`Found ${gamesWithoutStats.length} games without stats`));
    
    if (gamesWithoutStats.length === 0) {
      console.log(chalk.green('All games have stats!'));
      return;
    }
    
    // 2. Load player cache
    console.log(chalk.yellow('Loading NFL players...'));
    const playerCache: Record<string, number> = {};
    
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .eq('sport', 'nfl')
        .range(offset, offset + limit - 1);
      
      if (players && players.length > 0) {
        players.forEach(p => {
          const key = p.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          playerCache[key] = p.id;
        });
        offset += players.length;
        hasMore = players.length === limit;
      } else {
        hasMore = false;
      }
    }
    
    console.log(chalk.green(`Loaded ${Object.keys(playerCache).length} players`));
    
    // 3. Process first 10 games
    const gamesToProcess = gamesWithoutStats.slice(0, 10);
    console.log(chalk.yellow(`\nProcessing ${gamesToProcess.length} games...\n`));
    
    let successCount = 0;
    
    for (const game of gamesToProcess) {
      const espnId = game.external_id?.replace(/^(?:espn_)?(?:nfl_)?/, '');
      console.log(chalk.blue(`Processing game ${game.id} (ESPN: ${espnId})`));
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          { 
            params: { event: espnId },
            timeout: 10000
          }
        );
        
        if (response.data.boxscore?.players) {
          const stats = [];
          
          for (const team of response.data.boxscore.players) {
            for (const category of (team.statistics || [])) {
              for (const athlete of (category.athletes || [])) {
                const playerName = athlete.athlete?.displayName;
                const playerKey = playerName?.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                const playerId = playerCache[playerKey];
                
                if (playerId) {
                  stats.push({
                    game_id: game.id,
                    player_id: playerId,
                    game_date: game.start_time.split('T')[0],
                    stats: {
                      category: category.name,
                      values: athlete.stats
                    },
                    fantasy_points: 0
                  });
                }
              }
            }
          }
          
          if (stats.length > 0) {
            const { error } = await supabase
              .from('player_game_logs')
              .insert(stats);
            
            if (error) {
              console.error(chalk.red(`  DB Error: ${error.message}`));
            } else {
              console.log(chalk.green(`  ✅ Saved ${stats.length} stats`));
              successCount++;
            }
          } else {
            console.log(chalk.yellow(`  No players matched`));
          }
        } else {
          console.log(chalk.yellow(`  No boxscore data`));
        }
      } catch (error: any) {
        console.log(chalk.red(`  API Error: ${error.message}`));
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // 4. Check new coverage
    console.log(chalk.cyan('\n📊 CHECKING NEW COVERAGE...'));
    
    let newGamesWithStats = 0;
    for (const game of all2024Games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        newGamesWithStats++;
      }
    }
    
    const newCoverage = ((newGamesWithStats / all2024Games.length) * 100).toFixed(1);
    
    console.log(chalk.bold.yellow('\nRESULTS:'));
    console.log(`Processed: ${gamesToProcess.length} games`);
    console.log(`Successful: ${successCount} games`);
    console.log(`New coverage: ${newCoverage}% (${newGamesWithStats}/${all2024Games.length})`);
    
    if (successCount > 0) {
      console.log(chalk.green('\n✅ ACTUALLY IMPLEMENTED - Check database!'));
    } else {
      console.log(chalk.red('\n❌ No games were successfully processed'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

runFix();