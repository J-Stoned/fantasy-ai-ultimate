#!/usr/bin/env tsx
/**
 * ALL SPORTS REAL COLLECTOR - NBA, NFL, MLB, NHL with COMPLETE data
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

console.log(chalk.bold.cyan('🎯 ALL SPORTS REAL DATA COLLECTOR'));

interface SportConfig {
  sport: string;
  league: string;
  statFields: string[];
  parseStats: (rawStats: string[]) => any;
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  NBA: {
    sport: 'NBA',
    league: 'basketball/nba',
    statFields: ['MIN', 'FG', '3PT', 'FT', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '+/-', 'PTS'],
    parseStats: (rawStats: string[]) => ({
      minutes: parseInt(rawStats[0]) || 0,
      fieldGoalsMade: parseInt(rawStats[1]?.split('-')[0]) || 0,
      fieldGoalsAttempted: parseInt(rawStats[1]?.split('-')[1]) || 0,
      threePointersMade: parseInt(rawStats[2]?.split('-')[0]) || 0,
      threePointersAttempted: parseInt(rawStats[2]?.split('-')[1]) || 0,
      freeThrowsMade: parseInt(rawStats[3]?.split('-')[0]) || 0,
      freeThrowsAttempted: parseInt(rawStats[3]?.split('-')[1]) || 0,
      offensiveRebounds: parseInt(rawStats[4]) || 0,
      defensiveRebounds: parseInt(rawStats[5]) || 0,
      rebounds: parseInt(rawStats[6]) || 0,
      assists: parseInt(rawStats[7]) || 0,
      steals: parseInt(rawStats[8]) || 0,
      blocks: parseInt(rawStats[9]) || 0,
      turnovers: parseInt(rawStats[10]) || 0,
      fouls: parseInt(rawStats[11]) || 0,
      plusMinus: parseInt(rawStats[12]) || 0,
      points: parseInt(rawStats[13]) || 0
    })
  },
  NFL: {
    sport: 'NFL',
    league: 'football/nfl',
    statFields: ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'],
    parseStats: (rawStats: string[]) => {
      // Handle different position types
      if (rawStats.length >= 8) { // QB stats
        const completions = rawStats[0]?.split('/')[0] || '0';
        const attempts = rawStats[0]?.split('/')[1] || '0';
        return {
          completions: parseInt(completions),
          attempts: parseInt(attempts),
          passingYards: parseInt(rawStats[1]) || 0,
          yardsPerAttempt: parseFloat(rawStats[2]) || 0,
          touchdowns: parseInt(rawStats[3]) || 0,
          interceptions: parseInt(rawStats[4]) || 0,
          sacks: parseInt(rawStats[5]) || 0,
          qbr: parseFloat(rawStats[6]) || 0,
          rating: parseFloat(rawStats[7]) || 0
        };
      } else if (rawStats.length >= 5) { // RB/WR stats
        return {
          carries: parseInt(rawStats[0]) || 0,
          rushingYards: parseInt(rawStats[1]) || 0,
          yardsPerCarry: parseFloat(rawStats[2]) || 0,
          rushingTouchdowns: parseInt(rawStats[3]) || 0,
          longRush: parseInt(rawStats[4]) || 0
        };
      }
      return {};
    }
  },
  MLB: {
    sport: 'MLB',
    league: 'baseball/mlb',
    statFields: ['AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'K', 'AVG', 'OBP', 'SLG'],
    parseStats: (rawStats: string[]) => ({
      atBats: parseInt(rawStats[0]) || 0,
      runs: parseInt(rawStats[1]) || 0,
      hits: parseInt(rawStats[2]) || 0,
      doubles: parseInt(rawStats[3]) || 0,
      triples: parseInt(rawStats[4]) || 0,
      homeRuns: parseInt(rawStats[5]) || 0,
      rbi: parseInt(rawStats[6]) || 0,
      walks: parseInt(rawStats[7]) || 0,
      strikeouts: parseInt(rawStats[8]) || 0,
      battingAverage: parseFloat(rawStats[9]) || 0,
      onBasePercentage: parseFloat(rawStats[10]) || 0,
      sluggingPercentage: parseFloat(rawStats[11]) || 0
    })
  },
  NHL: {
    sport: 'NHL',
    league: 'hockey/nhl',
    statFields: ['G', 'A', 'PTS', '+/-', 'S', 'BLK', 'HIT', 'FOW', 'FOL', 'TOI'],
    parseStats: (rawStats: string[]) => ({
      goals: parseInt(rawStats[0]) || 0,
      assists: parseInt(rawStats[1]) || 0,
      points: parseInt(rawStats[2]) || 0,
      plusMinus: parseInt(rawStats[3]) || 0,
      shots: parseInt(rawStats[4]) || 0,
      blockedShots: parseInt(rawStats[5]) || 0,
      hits: parseInt(rawStats[6]) || 0,
      faceoffWins: parseInt(rawStats[7]) || 0,
      faceoffLosses: parseInt(rawStats[8]) || 0,
      timeOnIce: rawStats[9] || '0:00'
    })
  }
};

const stats = {
  NBA: { games: 0, players: 0, complete: 0 },
  NFL: { games: 0, players: 0, complete: 0 },
  MLB: { games: 0, players: 0, complete: 0 },
  NHL: { games: 0, players: 0, complete: 0 }
};

async function getRecentGames(sport: string, league: string) {
  try {
    const dates = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${dates}&limit=10`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    );
    
    const games = [];
    if (response.data?.events) {
      for (const event of response.data.events) {
        if (event.status?.type?.completed) {
          games.push({ id: event.id, name: event.name });
        }
      }
    }
    
    console.log(chalk.gray(`  Found ${games.length} recent ${sport} games`));
    return games;
    
  } catch (error) {
    console.log(chalk.yellow(`  No recent ${sport} games found`));
    return [];
  }
}

async function collectSportGame(gameId: string, config: SportConfig) {
  try {
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/${config.league}/summary?event=${gameId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
    );
    
    const gameData = response.data;
    const boxscore = gameData.boxscore;
    
    if (!boxscore?.players) return;
    
    // Get teams
    const homeTeam = boxscore.teams[0];
    const awayTeam = boxscore.teams[1];
    
    // Check if teams exist
    const { data: homeTeamData } = await supabase
      .from('teams')
      .select('id')
      .eq('external_id', `espn_${config.sport.toLowerCase()}_${homeTeam.team.id}`)
      .single();
    
    const { data: awayTeamData } = await supabase
      .from('teams')
      .select('id')
      .eq('external_id', `espn_${config.sport.toLowerCase()}_${awayTeam.team.id}`)
      .single();
    
    if (!homeTeamData || !awayTeamData) {
      // Create teams
      const { data: newHome } = await supabase
        .from('teams')
        .upsert({
          name: homeTeam.team.displayName,
          abbreviation: homeTeam.team.abbreviation,
          sport: config.sport,
          external_id: `espn_${config.sport.toLowerCase()}_${homeTeam.team.id}`
        })
        .select('id')
        .single();
      
      const { data: newAway } = await supabase
        .from('teams')
        .upsert({
          name: awayTeam.team.displayName,
          abbreviation: awayTeam.team.abbreviation,
          sport: config.sport,
          external_id: `espn_${config.sport.toLowerCase()}_${awayTeam.team.id}`
        })
        .select('id')
        .single();
        
      if (!newHome || !newAway) return;
    }
    
    const homeId = homeTeamData?.id || null;
    const awayId = awayTeamData?.id || null;
    
    // Create/update game
    const { data: game } = await supabase
      .from('games')
      .upsert({
        external_id: `espn_${config.sport.toLowerCase()}_${gameId}`,
        sport: config.sport,
        home_team_id: homeId,
        away_team_id: awayId,
        home_score: parseInt(homeTeam.statistics?.[0]?.displayValue || '0'),
        away_score: parseInt(awayTeam.statistics?.[0]?.displayValue || '0'),
        start_time: gameData.header?.competitions?.[0]?.date || new Date().toISOString(),
        status: 'completed'
      })
      .select('id')
      .single();
    
    if (!game) return;
    
    stats[config.sport].games++;
    
    // Process players
    for (let teamIndex = 0; teamIndex < boxscore.players.length; teamIndex++) {
      const teamPlayers = boxscore.players[teamIndex];
      const teamId = teamIndex === 0 ? homeId : awayId;
      const opponentId = teamIndex === 0 ? awayId : homeId;
      const isHome = teamIndex === 0;
      
      if (!teamPlayers.statistics?.[0]?.athletes) continue;
      
      for (const athlete of teamPlayers.statistics[0].athletes) {
        if (!athlete.stats || athlete.stats.length === 0) continue;
        
        // Parse stats based on sport
        const statsObj = config.parseStats(athlete.stats);
        
        // Get/create player
        let { data: player } = await supabase
          .from('players')
          .select('id')
          .eq('external_id', `espn_${config.sport.toLowerCase()}_${athlete.athlete.id}`)
          .single();
        
        if (!player) {
          const { data: newPlayer } = await supabase
            .from('players')
            .insert({
              name: athlete.athlete.displayName,
              external_id: `espn_${config.sport.toLowerCase()}_${athlete.athlete.id}`,
              sport: config.sport,
              team_id: teamId
            })
            .select('id')
            .single();
          
          player = newPlayer;
        }
        
        if (!player) continue;
        
        // Check for existing log
        const { data: existingLog } = await supabase
          .from('player_game_logs')
          .select('id')
          .eq('player_id', player.id)
          .eq('game_id', game.id)
          .single();
        
        if (!existingLog) {
          const { error } = await supabase
            .from('player_game_logs')
            .insert({
              player_id: player.id,
              game_id: game.id,
              team_id: teamId,
              opponent_id: opponentId,
              is_home: isHome,
              minutes_played: statsObj.minutes || statsObj.timeOnIce || null,
              stats: statsObj,
              game_date: gameData.header?.competitions?.[0]?.date || new Date().toISOString(),
              sport: config.sport
            });
          
          if (!error) {
            stats[config.sport].players++;
            if (Object.keys(statsObj).length > 3) {
              stats[config.sport].complete++;
            }
          }
        }
      }
    }
    
  } catch (error: any) {
    console.log(chalk.red(`    Error: ${error.message}`));
  }
}

async function collectAllSports() {
  for (const [sport, config] of Object.entries(SPORT_CONFIGS)) {
    console.log(chalk.bold.blue(`\n🏆 Collecting ${sport} data...`));
    
    const games = await getRecentGames(sport, config.league);
    
    if (games.length === 0) {
      console.log(chalk.yellow(`  Skipping ${sport} - no games available`));
      continue;
    }
    
    // Process games
    for (const game of games.slice(0, 5)) { // Limit to 5 games per sport
      console.log(chalk.gray(`  Processing: ${game.name}...`));
      await collectSportGame(game.id, config);
    }
    
    console.log(chalk.green(
      `  ✅ ${sport}: ${stats[sport].games} games, ${stats[sport].players} players, ${stats[sport].complete} complete`
    ));
    
    // Rate limit between sports
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function main() {
  await collectAllSports();
  
  // Summary
  console.log(chalk.bold.cyan('\n📊 COLLECTION SUMMARY:'));
  
  let totalGames = 0;
  let totalPlayers = 0;
  let totalComplete = 0;
  
  for (const [sport, sportStats] of Object.entries(stats)) {
    totalGames += sportStats.games;
    totalPlayers += sportStats.players;
    totalComplete += sportStats.complete;
    
    if (sportStats.games > 0) {
      console.log(chalk.white(
        `${sport}: ${sportStats.games} games, ${sportStats.players} players (${sportStats.complete} complete)`
      ));
    }
  }
  
  console.log(chalk.bold.green(
    `\nTOTAL: ${totalGames} games, ${totalPlayers} players, ${totalComplete} complete records`
  ));
  
  // Verify data quality
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null)
    .not('opponent_id', 'is', null)
    .not('stats', 'is', null);
  
  console.log(chalk.bold.blue(`\n🔍 Database now has ${count?.toLocaleString()} COMPLETE player records`));
  
  console.log(chalk.bold.cyan('\n🎯 READY FOR REAL PATTERN DETECTION!'));
}

main().catch(console.error);