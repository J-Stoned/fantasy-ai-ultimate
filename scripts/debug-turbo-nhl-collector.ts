#!/usr/bin/env tsx
/**
 * 🔍 DEBUG TURBO NHL COLLECTOR
 * 
 * Modified turbo collector with debug logging
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HTTP_LIMIT = pLimit(1); // Single request for debugging

async function debugCollectStats() {
  console.log(chalk.bold.cyan('🔍 DEBUG TURBO NHL COLLECTOR\n'));
  
  // Get just 2 games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26')
    .limit(2);
    
  if (!games || games.length === 0) {
    console.error(chalk.red('No games found!'));
    return;
  }
  
  console.log(chalk.green(`Found ${games.length} games\n`));
  
  // Load players
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id')
    .eq('sport', 'NHL');
    
  const playerMap = new Map(
    players?.map(p => [p.external_id, p.id]) || []
  );
  
  console.log(chalk.green(`Loaded ${playerMap.size} players\n`));
  
  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  const allStats: any[] = [];
  
  for (const game of games) {
    console.log(chalk.yellow(`Processing game: ${game.external_id}`));
    
    const gameId = game.external_id.split('_').pop();
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const data = response.data;
      
      if (!data.boxscore?.players) {
        console.log(chalk.red('  No boxscore.players'));
        continue;
      }
      
      let gameStatCount = 0;
      
      for (const team of data.boxscore.players) {
        const espnTeamId = team.team.id;
        const teamId = teamMap.get(String(espnTeamId));
        
        if (!teamId) {
          console.log(chalk.red(`  Team ${espnTeamId} not found`));
          continue;
        }
        
        const isHome = team.homeAway === 'home';
        const opponentId = isHome ? game.away_team_id : game.home_team_id;
        
        for (const statGroup of team.statistics || []) {
          const groupName = statGroup.name?.toLowerCase() || '';
          console.log(chalk.gray(`  Processing stat group: "${groupName}"`));
          
          for (const athlete of statGroup.athletes || []) {
            const playerId = athlete.athlete?.id;
            if (!playerId) continue;
            
            const dbPlayerId = playerMap.get(`espn_nhl_${playerId}`);
            if (!dbPlayerId) {
              console.log(chalk.red(`    Player espn_nhl_${playerId} not found`));
              continue;
            }
            
            const statValues = athlete.stats || [];
            const stats: any = {};
            
            if (groupName.includes('forward') || groupName.includes('defense')) {
              stats.goals = parseInt(statValues[9]) || 0;
              stats.assists = parseInt(statValues[11]) || 0;
              stats.shots = parseInt(statValues[12]) || 0;
              stats.shots_on_goal = parseInt(statValues[14]) || 0;
              stats.plus_minus = parseInt(statValues[3]) || 0;
              stats.penalty_minutes = parseInt(statValues[20]) || 0;
              stats.blocked_shots = parseInt(statValues[0]) || 0;
              stats.hits = parseInt(statValues[1]) || 0;
              stats.takeaways = parseInt(statValues[2]) || 0;
              stats.time_on_ice = statValues[4] || '0:00';
              stats.faceoff_wins = parseInt(statValues[15]) || 0;
              stats.faceoff_losses = parseInt(statValues[16]) || 0;
              stats.points = stats.goals + stats.assists;
            } else if (groupName.includes('goalie')) {
              stats.saves = parseInt(statValues[3]) || 0;
              stats.goals_against = parseInt(statValues[1]) || 0;
              stats.shots_against = parseInt(statValues[2]) || 0;
              stats.save_percentage = statValues[4] || 0;
              stats.time_on_ice = statValues[0] || '0:00';
            }
            
            if (Object.keys(stats).length === 0) {
              console.log(chalk.red(`    No stats parsed for ${athlete.athlete?.displayName}`));
              continue;
            }
            
            console.log(chalk.green(`    ✅ Parsed stats for ${athlete.athlete?.displayName}: ${Object.keys(stats).length} fields`));
            
            const fantasyPoints = (stats.goals || 0) * 3 + 
                                 (stats.assists || 0) * 2 + 
                                 (stats.shots_on_goal || 0) * 0.5;
            
            allStats.push({
              player_id: dbPlayerId,
              game_id: game.id,
              team_id: teamId,
              opponent_id: opponentId,
              game_date: new Date(game.start_time).toISOString().split('T')[0],
              is_home: isHome,
              stats: stats,
              fantasy_points: fantasyPoints,
              metadata: {
                sport: 'NHL',
                stat_group: groupName,
                collection_source: 'debug-turbo'
              }
            });
            
            gameStatCount++;
          }
        }
      }
      
      console.log(chalk.blue(`  Game total: ${gameStatCount} stats`));
      
    } catch (error: any) {
      console.error(chalk.red(`  Error: ${error.message}`));
    }
  }
  
  console.log(chalk.bold.cyan(`\n${'='.repeat(50)}`));
  console.log(chalk.bold.cyan(`TOTAL STATS TO INSERT: ${allStats.length}`));
  console.log(chalk.bold.cyan('='.repeat(50)));
  
  if (allStats.length > 0) {
    console.log(chalk.yellow('\nInserting stats...'));
    
    const { error, data } = await supabase
      .from('player_game_logs')
      .insert(allStats)
      .select();
      
    if (error) {
      console.error(chalk.red('Insert error:'), error);
    } else {
      console.log(chalk.green(`✅ Inserted ${data?.length || allStats.length} stats!`));
    }
  }
}

debugCollectStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });