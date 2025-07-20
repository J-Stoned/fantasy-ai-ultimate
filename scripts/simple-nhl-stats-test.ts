#!/usr/bin/env tsx
/**
 * 🏒 SIMPLE NHL STATS TEST
 * 
 * Collects stats for just ONE game to see what's happening
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function simpleStatsTest() {
  console.log(chalk.bold.cyan('🏒 SIMPLE NHL STATS TEST\n'));
  
  // Get ONE game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-12')
    .limit(1);
    
  const game = games![0];
  console.log(chalk.yellow(`Testing with game: ${game.external_id}\n`));
  
  // Load ALL players properly
  let allPlayers: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NHL')
      .range(offset, offset + 999)
      .order('id');
      
    if (!players || players.length === 0) break;
    allPlayers = allPlayers.concat(players);
    offset += players.length;
    if (players.length < 1000) break;
  }
  
  const playerMap = new Map(allPlayers.map(p => [p.external_id, p.id]));
  console.log(chalk.green(`Loaded ${playerMap.size} players\n`));
  
  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  // Make API call
  const gameId = game.external_id.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
  
  console.log(chalk.gray(`Fetching: ${url}\n`));
  
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const data = response.data;
  const statsToInsert: any[] = [];
  
  console.log(chalk.yellow('Processing teams...\n'));
  
  for (const team of data.boxscore.players) {
    const espnTeamId = team.team.id;
    const teamId = teamMap.get(String(espnTeamId));
    
    console.log(chalk.cyan(`Team: ${team.team.displayName}`));
    
    if (!teamId) {
      console.log(chalk.red(`  Team not found in DB!`));
      continue;
    }
    
    const isHome = team.homeAway === 'home';
    const opponentId = isHome ? game.away_team_id : game.home_team_id;
    
    for (const statGroup of team.statistics || []) {
      const groupName = statGroup.name?.toLowerCase() || '';
      console.log(chalk.gray(`  Stat group: "${groupName}"`));
      
      let groupStats = 0;
      
      for (const athlete of statGroup.athletes || []) {
        const playerId = athlete.athlete?.id;
        if (!playerId) continue;
        
        const dbPlayerId = playerMap.get(`espn_nhl_${playerId}`);
        if (!dbPlayerId) {
          console.log(chalk.red(`    Player not found: espn_nhl_${playerId}`));
          continue;
        }
        
        const statValues = athlete.stats || [];
        const stats: any = {};
        
        // This is the key part - checking if stats are being parsed
        console.log(chalk.gray(`    Checking conditions for ${athlete.athlete?.displayName}...`));
        console.log(chalk.gray(`      groupName.includes('forward'): ${groupName.includes('forward')}`));
        console.log(chalk.gray(`      groupName.includes('defense'): ${groupName.includes('defense')}`));
        console.log(chalk.gray(`      groupName.includes('goalie'): ${groupName.includes('goalie')}`));
        
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
        
        console.log(chalk.gray(`      Stats object keys: ${Object.keys(stats).length}`));
        
        if (Object.keys(stats).length === 0) {
          console.log(chalk.red(`    ❌ No stats parsed`));
          continue;
        }
        
        console.log(chalk.green(`    ✅ Stats parsed: G:${stats.goals || 0} A:${stats.assists || 0}`));
        
        const fantasyPoints = (stats.goals || 0) * 3 + 
                             (stats.assists || 0) * 2 + 
                             (stats.shots_on_goal || 0) * 0.5;
        
        statsToInsert.push({
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
            collection_source: 'simple-test'
          }
        });
        
        groupStats++;
      }
      
      console.log(chalk.blue(`    Group total: ${groupStats} stats`));
    }
  }
  
  console.log(chalk.bold.yellow(`\nTOTAL STATS TO INSERT: ${statsToInsert.length}`));
  
  if (statsToInsert.length > 0) {
    console.log(chalk.yellow('\nInserting stats...'));
    
    const { error, data } = await supabase
      .from('player_game_logs')
      .insert(statsToInsert)
      .select();
      
    if (error) {
      console.error(chalk.red('Insert error:'), error);
    } else {
      console.log(chalk.green(`✅ Successfully inserted ${data?.length || statsToInsert.length} stats!`));
    }
  }
}

simpleStatsTest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });