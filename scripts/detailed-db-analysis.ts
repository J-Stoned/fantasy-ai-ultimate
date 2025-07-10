#!/usr/bin/env tsx
/**
 * Detailed database analysis for stats collector
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function detailedAnalysis() {
  console.log(chalk.blue('\n=== DETAILED DATABASE ANALYSIS ===\n'));

  // 1. Check teams table
  console.log(chalk.cyan('1. TEAMS ANALYSIS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, sport, abbreviation, external_id')
    .order('id')
    .limit(20);

  if (!teamsError && teams) {
    console.log(`\nSample teams (${teams.length}):`);
    teams.forEach(team => {
      console.log(`  ID: ${team.id}, Name: "${team.name}", Sport: ${team.sport}, Abbr: ${team.abbreviation}`);
    });
  }

  // 2. Check games with proper team links
  console.log(chalk.cyan('\n\n2. GAMES WITH TEAM LINKS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: gamesWithTeams } = await supabase
    .from('games')
    .select(`
      id,
      external_id,
      sport,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      home_team:teams!games_home_team_id_fkey(name, abbreviation),
      away_team:teams!games_away_team_id_fkey(name, abbreviation)
    `)
    .not('home_score', 'is', null)
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null)
    .order('id', { ascending: false })
    .limit(10);

  if (gamesWithTeams) {
    console.log(`\nGames with valid team links:`);
    gamesWithTeams.forEach(game => {
      const homeTeam = game.home_team?.name || `Team ${game.home_team_id}`;
      const awayTeam = game.away_team?.name || `Team ${game.away_team_id}`;
      console.log(`\nGame ${game.id} (${game.external_id}):`);
      console.log(`  Sport: ${game.sport}`);
      console.log(`  ${homeTeam} ${game.home_score} - ${game.away_score} ${awayTeam}`);
    });
  }

  // 3. Check different sport values
  console.log(chalk.cyan('\n\n3. SPORT VALUES IN GAMES'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: sportValues } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null);

  const sportCounts: Record<string, number> = {};
  sportValues?.forEach(row => {
    const sport = row.sport;
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });

  console.log('\nUnique sport values:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  "${sport}": ${count} games`);
  });

  // 4. Check games without teams
  console.log(chalk.cyan('\n\n4. GAMES WITHOUT TEAM LINKS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { count: gamesNoTeams } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_team_id.is.null,away_team_id.is.null')
    .not('home_score', 'is', null);

  console.log(`\nGames with scores but missing team links: ${gamesNoTeams}`);

  // 5. Check how stats are currently stored
  console.log(chalk.cyan('\n\n5. PLAYER STATS PATTERNS'));
  console.log(chalk.gray('─'.repeat(50)));

  // Get a game with many stats
  const { data: gameWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(100);

  const gameStatCounts: Record<number, number> = {};
  gameWithStats?.forEach(stat => {
    gameStatCounts[stat.game_id] = (gameStatCounts[stat.game_id] || 0) + 1;
  });

  const sortedGames = Object.entries(gameStatCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1);

  if (sortedGames.length > 0) {
    const [gameId, statCount] = sortedGames[0];
    console.log(`\nAnalyzing game ${gameId} with ${statCount} stat records:`);

    const { data: gameStats } = await supabase
      .from('player_stats')
      .select(`
        id,
        player_id,
        stat_type,
        stat_value,
        player:players!player_stats_player_id_fkey(name, firstname, lastname)
      `)
      .eq('game_id', gameId)
      .limit(10);

    // Group by player
    const byPlayer: Record<number, any[]> = {};
    gameStats?.forEach(stat => {
      if (!byPlayer[stat.player_id]) byPlayer[stat.player_id] = [];
      byPlayer[stat.player_id].push(stat);
    });

    Object.entries(byPlayer).slice(0, 2).forEach(([playerId, stats]) => {
      const playerName = stats[0].player?.name || 
        `${stats[0].player?.firstname} ${stats[0].player?.lastname}`;
      console.log(`\n  Player: ${playerName} (ID: ${playerId})`);
      stats.forEach(stat => {
        const value = typeof stat.stat_value === 'string' ? 
          stat.stat_value.substring(0, 50) : 
          JSON.stringify(stat.stat_value);
        console.log(`    ${stat.stat_type}: ${value}`);
      });
    });
  }

  // 6. Test API URL construction
  console.log(chalk.cyan('\n\n6. ESPN API URL PATTERNS'));
  console.log(chalk.gray('─'.repeat(50)));

  // Find games for each sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  for (const sport of sports) {
    const { data: sportGame } = await supabase
      .from('games')
      .select('id, external_id')
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .limit(1);

    if (sportGame && sportGame[0]) {
      const espnId = sportGame[0].external_id.replace('espn_', '');
      console.log(`\n${sport} Game: ${sportGame[0].external_id}`);
      console.log(`  ESPN ID: ${espnId}`);
      
      // Map sport to ESPN API sport slug
      const sportMap: Record<string, string> = {
        'NFL': 'football/nfl',
        'NBA': 'basketball/nba',
        'MLB': 'baseball/mlb',
        'NHL': 'hockey/nhl',
        'NCAAF': 'football/college-football',
        'NCAAB': 'basketball/mens-college-basketball'
      };
      
      const sportSlug = sportMap[sport] || sport.toLowerCase();
      console.log(`  API URL: https://site.api.espn.com/apis/site/v2/sports/${sportSlug}/summary?event=${espnId}`);
    }
  }

  console.log(chalk.blue('\n\n=== ANALYSIS COMPLETE ==='));
}

detailedAnalysis().catch(console.error);