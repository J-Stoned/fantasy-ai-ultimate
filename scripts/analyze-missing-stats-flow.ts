#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE MISSING STATS - CHECK DATA FLOW
 * teams → games → players → stats
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

async function analyzeMissingStats() {
  console.log(chalk.bold.cyan('🔍 ANALYZING MISSING STATS - DATA FLOW CHECK\n'));
  console.log(chalk.yellow('Order: teams → games → players → stats\n'));

  // 1. Check teams
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL');

  console.log(chalk.green(`✅ NFL Teams: ${teamCount}`));
  
  // 2. Check 2021 games
  const { data: games, count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  console.log(chalk.green(`✅ 2021 NFL Games: ${gameCount}`));

  // 3. Check NFL players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  console.log(chalk.green(`✅ NFL Players: ${playerCount}\n`));

  // 4. Sample game analysis
  const sampleGame = games?.[0];
  if (!sampleGame) return;

  console.log(chalk.yellow(`📊 Analyzing sample game: ${sampleGame.external_id}`));
  console.log(chalk.gray(`  Home team ID: ${sampleGame.home_team_id}`));
  console.log(chalk.gray(`  Away team ID: ${sampleGame.away_team_id}`));

  // Check if teams exist
  const { data: homeTeam } = await supabase
    .from('teams')
    .select('*')
    .eq('id', sampleGame.home_team_id)
    .single();

  const { data: awayTeam } = await supabase
    .from('teams')
    .select('*')
    .eq('id', sampleGame.away_team_id)
    .single();

  console.log(chalk.gray(`  Home team: ${homeTeam?.name || 'NOT FOUND'}`));
  console.log(chalk.gray(`  Away team: ${awayTeam?.name || 'NOT FOUND'}\n`));

  // Get current stats for this game
  const { data: currentStats, count: statCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact' })
    .eq('game_id', sampleGame.id);

  console.log(chalk.blue(`Current stats in DB: ${statCount}`));

  // Get players in current stats
  const playerIds = new Set(currentStats?.map(s => s.player_id));
  console.log(chalk.blue(`Unique players with stats: ${playerIds.size}\n`));

  // Fetch ESPN data to see what we should have
  const espnGameId = sampleGame.external_id?.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
  
  try {
    const response = await axios.get(url);
    const gameData = response.data;

    let expectedPlayers = new Set<string>();
    let statGroupCounts: Record<string, number> = {};

    if (gameData.boxscore?.players) {
      for (const team of gameData.boxscore.players) {
        console.log(chalk.cyan(`\n${team.team.displayName}:`));
        
        for (const statGroup of team.statistics || []) {
          const groupName = statGroup.name;
          statGroupCounts[groupName] = (statGroupCounts[groupName] || 0) + (statGroup.athletes?.length || 0);
          
          console.log(chalk.gray(`  ${groupName}: ${statGroup.athletes?.length || 0} players`));
          
          for (const athlete of statGroup.athletes || []) {
            expectedPlayers.add(`espn_nfl_${athlete.athlete?.id}`);
          }
        }
      }
    }

    console.log(chalk.yellow(`\n📊 Expected vs Actual:`));
    console.log(`  Expected unique players: ${expectedPlayers.size}`);
    console.log(`  Actual unique players: ${playerIds.size}`);
    console.log(`  Missing: ${expectedPlayers.size - playerIds.size}`);

    // Check which players are missing from database
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('external_id')
      .eq('sport', 'NFL')
      .in('external_id', Array.from(expectedPlayers));

    const dbPlayerSet = new Set(dbPlayers?.map(p => p.external_id) || []);
    const missingFromDB = Array.from(expectedPlayers).filter(id => !dbPlayerSet.has(id));

    if (missingFromDB.length > 0) {
      console.log(chalk.red(`\n⚠️  ${missingFromDB.length} players missing from players table!`));
      console.log(chalk.red('This breaks the foreign key chain: teams → games → players → stats'));
    }

    // Check stat groups
    console.log(chalk.yellow('\n📊 Stat groups breakdown:'));
    Object.entries(statGroupCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([group, count]) => {
        console.log(`  ${group}: ${count} players`);
      });

  } catch (error) {
    console.error(chalk.red('Error fetching ESPN data'));
  }

  // Final summary
  console.log(chalk.bold.cyan('\n🎯 SUMMARY:'));
  console.log(`Current average: 63 stats/game`);
  console.log(`Target: 78 stats/game`);
  console.log(`Missing: 15 stats/game = ~3,855 total stats`);
  
  console.log(chalk.yellow('\n🔍 Likely issues:'));
  console.log('1. Missing players in database (breaks foreign key chain)');
  console.log('2. Players not mapped to correct teams');
  console.log('3. Some stat groups might be filtered out');
}

analyzeMissingStats().catch(console.error);