#!/usr/bin/env tsx
/**
 * Quick Stats Collector - Gets stats for recent games only
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function quickStatsCollection() {
  console.log(chalk.blue.bold('⚡ QUICK STATS COLLECTION\n'));
  
  // Get recent games without stats
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nfl')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20);
  
  if (!games || games.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(chalk.yellow(`Processing ${games.length} recent NFL games...\n`));
  
  let statsAdded = 0;
  let gamesProcessed = 0;
  
  for (const game of games) {
    try {
      // Check if already has stats
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        console.log(chalk.gray(`Game ${game.id} already has stats`));
        continue;
      }
      
      const espnId = game.external_id.replace('nfl_', '');
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`
      );
      
      const boxscore = response.data.boxscore;
      
      if (!boxscore || !boxscore.players) {
        console.log(chalk.gray(`No boxscore for game ${game.id}`));
        continue;
      }
      
      // Process simplified stats
      for (const teamPlayers of boxscore.players) {
        for (const category of teamPlayers.statistics || []) {
          const statType = category.name.toLowerCase();
          
          // Just get QB stats for now
          if (statType === 'passing') {
            for (const player of category.athletes || []) {
              if (player.stats.length >= 10) {
                const stats = [
                  { stat_type: 'passing_yards', stat_value: parseInt(player.stats[2]) || 0 },
                  { stat_type: 'passing_touchdowns', stat_value: parseInt(player.stats[5]) || 0 }
                ];
                
                for (const stat of stats) {
                  if (stat.stat_value > 0) {
                    await supabase
                      .from('player_stats')
                      .upsert({
                        game_id: game.id,
                        player_id: parseInt(player.athlete.id),
                        ...stat
                      });
                    
                    statsAdded++;
                  }
                }
              }
            }
          }
        }
      }
      
      gamesProcessed++;
      console.log(chalk.green(`✓ Game ${game.id}: Added stats`));
      
    } catch (error) {
      console.log(chalk.red(`✗ Game ${game.id}: Failed`));
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(chalk.green.bold('\n✅ QUICK STATS COMPLETE!\n'));
  console.log(`Games processed: ${gamesProcessed}`);
  console.log(`Stats added: ${statsAdded}`);
  
  // Check new coverage
  const { data: coveredGames } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
  
  const uniqueGames = new Set(coveredGames?.map(s => s.game_id) || []);
  console.log(chalk.yellow(`\nGames with stats: ${uniqueGames.size}`));
}

quickStatsCollection().catch(console.error);