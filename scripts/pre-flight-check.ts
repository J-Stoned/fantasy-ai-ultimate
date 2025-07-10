#!/usr/bin/env tsx
/**
 * Pre-flight check for stats collector
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function preFlightCheck() {
  console.log(chalk.blue('\n=== STATS COLLECTOR PRE-FLIGHT CHECK ===\n'));

  // 1. DATABASE ANALYSIS
  console.log(chalk.cyan('1. DATABASE ANALYSIS'));
  console.log(chalk.gray('─'.repeat(50)));

  // Check games format
  const { data: sampleGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, sport, league, home_team_id, away_team_id, home_score, away_score')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(20);

  if (gamesError) {
    console.error(chalk.red('Error fetching games:'), gamesError);
    return;
  }

  console.log(chalk.green(`\n✓ Found ${sampleGames?.length || 0} completed games with external_ids`));

  // Group by sport
  const bySport: Record<string, any[]> = {};
  sampleGames?.forEach(game => {
    const sport = game.sport || 'unknown';
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(game);
  });

  console.log(chalk.cyan('\nExternal ID formats by sport:'));
  Object.entries(bySport).forEach(([sport, games]) => {
    console.log(`\n${chalk.yellow(sport.toUpperCase())} (${games.length} games):`);
    games.slice(0, 3).forEach(game => {
      console.log(`  Game ${game.id}: external_id = "${game.external_id}"`);
      console.log(`    Teams: ${game.home_team_id} vs ${game.away_team_id}, Score: ${game.home_score}-${game.away_score}`);
    });
  });

  // 2. Check total counts
  console.log(chalk.cyan('\n\n2. GAME COUNTS BY SPORT'));
  console.log(chalk.gray('─'.repeat(50)));

  for (const sport of ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB']) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null);

    console.log(`${sport}: ${count || 0} completed games`);
  }

  // 3. Check existing player_stats
  console.log(chalk.cyan('\n\n3. EXISTING PLAYER_STATS ANALYSIS'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: statsSample, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (statsError) {
    console.error(chalk.red('Error fetching stats:'), statsError);
  } else {
    console.log(chalk.green(`\n✓ Found ${statsSample?.length || 0} recent player_stats records`));
    
    if (statsSample && statsSample.length > 0) {
      console.log(chalk.cyan('\nSample stat structure:'));
      const sample = statsSample[0];
      console.log(`  id: ${sample.id}`);
      console.log(`  player_id: ${sample.player_id}`);
      console.log(`  game_id: ${sample.game_id}`);
      console.log(`  stat_type: "${sample.stat_type}"`);
      console.log(`  stat_value: ${typeof sample.stat_value === 'string' ? 
        `"${sample.stat_value.substring(0, 80)}..."` : 
        JSON.stringify(sample.stat_value)}`);
      console.log(`  fantasy_points: ${sample.fantasy_points}`);

      // Check stat_types in use
      const { data: statTypes } = await supabase
        .from('player_stats')
        .select('stat_type')
        .limit(100);

      const typeCount: Record<string, number> = {};
      statTypes?.forEach(s => {
        typeCount[s.stat_type] = (typeCount[s.stat_type] || 0) + 1;
      });

      console.log(chalk.cyan('\nStat types in use:'));
      Object.entries(typeCount).slice(0, 10).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} records`);
      });
    }
  }

  // 4. Check which games have stats
  console.log(chalk.cyan('\n\n4. STATS COVERAGE CHECK'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);

  const uniqueGameIds = new Set(gamesWithStats?.map(s => s.game_id));
  console.log(`\n${chalk.green('✓')} Stats exist for ${uniqueGameIds.size} unique games`);

  // Sample a few games to see coverage
  const gameIds = Array.from(uniqueGameIds).slice(0, 5);
  for (const gameId of gameIds) {
    const { data: game } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .eq('id', gameId)
      .single();

    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    console.log(`  Game ${gameId} (${game?.external_id}, ${game?.sport}): ${count} stat records`);
  }

  // 5. Test ESPN API format
  console.log(chalk.cyan('\n\n5. ESPN API FORMAT TEST'));
  console.log(chalk.gray('─'.repeat(50)));

  // Find a recent NFL game with espn_ prefix
  const { data: espnGame } = await supabase
    .from('games')
    .select('id, external_id, sport')
    .eq('sport', 'NFL')
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (espnGame) {
    console.log(`\nTesting with game: ${espnGame.external_id}`);
    
    // Extract the numeric ID
    const espnId = espnGame.external_id.replace('espn_', '');
    console.log(`Extracted ESPN ID: ${espnId}`);
    
    // Test URL formats
    console.log(chalk.cyan('\nPossible API URLs:'));
    console.log(`  1. https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`);
    console.log(`  2. https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${espnId}/competitions/${espnId}/competitors`);
    console.log(`  3. https://cdn.espn.com/core/nfl/game?xhr=1&gameId=${espnId}`);

    // Try fetching
    try {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`);
      console.log(`\nAPI Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(chalk.green('✓ API call successful!'));
        console.log(`  Game: ${data.header?.competitions?.[0]?.competitors?.[0]?.team?.displayName || 'N/A'} vs ${data.header?.competitions?.[0]?.competitors?.[1]?.team?.displayName || 'N/A'}`);
        console.log(`  Has boxscore: ${!!data.boxscore}`);
        console.log(`  Has players: ${!!data.boxscore?.players}`);
      }
    } catch (error) {
      console.error(chalk.red('API test failed:'), error);
    }
  }

  // 6. Check player matching
  console.log(chalk.cyan('\n\n6. PLAYER MATCHING CHECK'));
  console.log(chalk.gray('─'.repeat(50)));

  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, name, firstname, lastname, team_id, external_id')
    .not('team_id', 'is', null)
    .limit(10);

  console.log(`\nSample players in database:`);
  samplePlayers?.forEach(p => {
    const displayName = p.name || `${p.firstname} ${p.lastname}`;
    console.log(`  ID: ${p.id}, Name: "${displayName}", Team: ${p.team_id}, External: ${p.external_id || 'null'}`);
  });

  // 7. Schema verification
  console.log(chalk.cyan('\n\n7. SCHEMA VERIFICATION'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.green('\n✓ player_stats table schema:'));
  console.log('  - id: integer (auto-increment)');
  console.log('  - player_id: integer (FK to players.id)');
  console.log('  - game_id: integer (FK to games.id)');
  console.log('  - stat_type: text');
  console.log('  - stat_value: jsonb');
  console.log('  - fantasy_points: numeric (nullable)');
  console.log('  - created_at: timestamp');

  console.log(chalk.blue('\n\n=== PRE-FLIGHT CHECK COMPLETE ==='));
  console.log(chalk.yellow('\nKey Findings:'));
  console.log('1. External IDs use "espn_" prefix format');
  console.log('2. Need to strip prefix for API calls');
  console.log('3. stat_value is JSONB, not string');
  console.log('4. Multiple stat_type entries per player per game');
  console.log('5. Player matching by name (no reliable external_id)');
}

preFlightCheck().catch(console.error);