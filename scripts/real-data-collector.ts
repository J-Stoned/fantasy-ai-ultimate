#!/usr/bin/env tsx
/**
 * REAL DATA COLLECTOR - Actually get complete, usable data
 * 
 * Starting with ONE NBA game to ensure we get it right
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.green('🎯 REAL DATA COLLECTOR - Getting COMPLETE data'));

interface PlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

async function collectOneNBAGame() {
  const gameId = 'espn_nba_401584802'; // Known working game
  const espnGameId = '401584802';
  
  console.log(chalk.blue(`\n🏀 Collecting COMPLETE data for NBA game ${espnGameId}...`));
  
  try {
    // 1. Get game info
    const gameResponse = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    
    const gameData = gameResponse.data;
    const boxscore = gameData.boxscore;
    
    if (!boxscore?.players) {
      throw new Error('No player data in boxscore');
    }
    
    // 2. Get or create game record
    const homeTeam = boxscore.teams[0];
    const awayTeam = boxscore.teams[1];
    
    console.log(chalk.gray(`${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`));
    console.log(chalk.gray(`Final: ${awayTeam.statistics[0].displayValue} - ${homeTeam.statistics[0].displayValue}`));
    
    // Get team IDs
    const { data: homeTeamData } = await supabase
      .from('teams')
      .select('id')
      .eq('name', homeTeam.team.displayName)
      .eq('sport', 'NBA')
      .single();
    
    const { data: awayTeamData } = await supabase
      .from('teams')
      .select('id')
      .eq('name', awayTeam.team.displayName)
      .eq('sport', 'NBA')
      .single();
    
    if (!homeTeamData || !awayTeamData) {
      console.log(chalk.yellow('Creating teams...'));
      // Create teams if needed
      const { data: newHomeTeam } = await supabase
        .from('teams')
        .upsert({
          name: homeTeam.team.displayName,
          abbreviation: homeTeam.team.abbreviation,
          sport: 'NBA',
          external_id: `espn_nba_${homeTeam.team.id}`
        })
        .select('id')
        .single();
      
      const { data: newAwayTeam } = await supabase
        .from('teams')
        .upsert({
          name: awayTeam.team.displayName,
          abbreviation: awayTeam.team.abbreviation,
          sport: 'NBA',
          external_id: `espn_nba_${awayTeam.team.id}`
        })
        .select('id')
        .single();
    }
    
    // Update game with complete info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .upsert({
        external_id: gameId,
        sport: 'NBA',
        home_team_id: homeTeamData?.id || null,
        away_team_id: awayTeamData?.id || null,
        home_score: parseInt(homeTeam.statistics[0].displayValue),
        away_score: parseInt(awayTeam.statistics[0].displayValue),
        start_time: gameData.header.competitions[0].date,
        status: 'completed'
      })
      .select('id')
      .single();
    
    if (!game) {
      throw new Error('Failed to create/update game');
    }
    
    console.log(chalk.green(`✅ Game record updated: ${game.id}`));
    
    // 3. Process player stats with COMPLETE data
    let totalPlayers = 0;
    let successfulPlayers = 0;
    
    for (let teamIndex = 0; teamIndex < boxscore.players.length; teamIndex++) {
      const teamPlayers = boxscore.players[teamIndex];
      const teamId = teamIndex === 0 ? homeTeamData?.id : awayTeamData?.id;
      const opponentId = teamIndex === 0 ? awayTeamData?.id : homeTeamData?.id;
      const isHome = teamIndex === 0;
      
      if (!teamPlayers.statistics || !teamPlayers.statistics[0]?.athletes) {
        console.log(chalk.yellow(`No player stats for team ${teamIndex}`));
        continue;
      }
      
      const athletes = teamPlayers.statistics[0].athletes;
      
      for (const athlete of athletes) {
        totalPlayers++;
        
        if (!athlete.stats || athlete.stats.length === 0) {
          console.log(chalk.yellow(`No stats for ${athlete.athlete.displayName}`));
          continue;
        }
        
        // Parse the stats array (14 elements for NBA)
        const rawStats = athlete.stats;
        const stats: PlayerStats = {
          minutes: parseInt(rawStats[0]) || 0,
          fieldGoalsMade: parseInt(rawStats[1]?.split('-')[0]) || 0,
          fieldGoalsAttempted: parseInt(rawStats[1]?.split('-')[1]) || 0,
          threePointersMade: parseInt(rawStats[2]?.split('-')[0]) || 0,
          threePointersAttempted: parseInt(rawStats[2]?.split('-')[1]) || 0,
          freeThrowsMade: parseInt(rawStats[3]?.split('-')[0]) || 0,
          freeThrowsAttempted: parseInt(rawStats[3]?.split('-')[1]) || 0,
          rebounds: parseInt(rawStats[6]) || 0,
          assists: parseInt(rawStats[7]) || 0,
          steals: parseInt(rawStats[8]) || 0,
          blocks: parseInt(rawStats[9]) || 0,
          turnovers: parseInt(rawStats[10]) || 0,
          fouls: parseInt(rawStats[11]) || 0,
          points: parseInt(rawStats[13]) || 0
        };
        
        // Get or create player
        const { data: player } = await supabase
          .from('players')
          .upsert({
            name: athlete.athlete.displayName,
            external_id: `espn_nba_${athlete.athlete.id}`,
            sport: 'NBA',
            team_id: teamId
          })
          .select('id')
          .single();
        
        if (!player) {
          console.log(chalk.red(`Failed to create player ${athlete.athlete.displayName}`));
          continue;
        }
        
        // Insert COMPLETE player game log
        const { error: logError } = await supabase
          .from('player_game_logs')
          .upsert({
            player_id: player.id,
            game_id: game.id,
            team_id: teamId,
            opponent_id: opponentId,
            is_home: isHome,
            minutes_played: stats.minutes,
            stats: stats,
            game_date: gameData.header.competitions[0].date,
            computed_metrics: {
              efficiency: (stats.points + stats.rebounds + stats.assists + stats.steals + stats.blocks - 
                          (stats.fieldGoalsAttempted - stats.fieldGoalsMade) - 
                          (stats.freeThrowsAttempted - stats.freeThrowsMade) - stats.turnovers),
              true_shooting: stats.fieldGoalsAttempted > 0 ? 
                (stats.points / (2 * (stats.fieldGoalsAttempted + 0.44 * stats.freeThrowsAttempted))) : 0,
              usage_rate: stats.minutes > 0 ? 
                ((stats.fieldGoalsAttempted + 0.44 * stats.freeThrowsAttempted + stats.turnovers) * 48) / stats.minutes : 0
            }
          });
        
        if (logError) {
          console.log(chalk.red(`Error saving ${athlete.athlete.displayName}: ${logError.message}`));
        } else {
          successfulPlayers++;
          console.log(chalk.green(`✅ ${athlete.athlete.displayName}: ${stats.points} pts, ${stats.rebounds} reb, ${stats.assists} ast (${stats.minutes} min)`));
        }
      }
    }
    
    console.log(chalk.bold.green(`\n✅ COMPLETE! Saved ${successfulPlayers}/${totalPlayers} players with FULL stats`));
    
    // Verify the data quality
    const { data: verifyLogs } = await supabase
      .from('player_game_logs')
      .select('*')
      .eq('game_id', game.id)
      .limit(5);
    
    if (verifyLogs && verifyLogs.length > 0) {
      console.log(chalk.bold.blue('\n🔍 Data Quality Check:'));
      const sample = verifyLogs[0];
      console.log(chalk.gray('Sample record has:'));
      console.log(chalk.green(`  ✅ team_id: ${sample.team_id ? 'YES' : 'NO'}`));
      console.log(chalk.green(`  ✅ opponent_id: ${sample.opponent_id ? 'YES' : 'NO'}`));
      console.log(chalk.green(`  ✅ minutes_played: ${sample.minutes_played ? 'YES' : 'NO'}`));
      console.log(chalk.green(`  ✅ stats: ${sample.stats ? 'YES' : 'NO'}`));
      console.log(chalk.green(`  ✅ computed_metrics: ${sample.computed_metrics ? 'YES' : 'NO'}`));
    }
    
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    if (error.response) {
      console.error(chalk.red(`API Error: ${error.response.status} ${error.response.statusText}`));
    }
  }
}

async function main() {
  await collectOneNBAGame();
  
  console.log(chalk.bold.cyan('\n🚀 NEXT STEPS:'));
  console.log(chalk.white('1. If successful, scale to more games'));
  console.log(chalk.white('2. Run pattern detection on this complete data'));
  console.log(chalk.white('3. Verify all fields are populated correctly'));
}

main();