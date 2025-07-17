#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeActualSynergies() {
  console.log(chalk.cyan('🔍 Analyzing actual synergy potential...\n'));
  
  // Get total completed games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  console.log(`Total completed games: ${chalk.yellow(totalGames)}`);
  
  // Sample games to check player counts
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .limit(200);
    
  if (!sampleGames) return;
  
  let teamsWithEnoughPlayers = 0;
  let totalTeamGames = 0;
  const sportBreakdown: Record<string, { total: number, withEnough: number }> = {};
  const playerCountDistribution: Record<number, number> = {};
  
  for (const game of sampleGames) {
    // Check home team with CORRECT column name
    const { data: homePlayers } = await supabase
      .from('player_game_logs')
      .select('player_id, minutes_played')
      .eq('game_id', game.id)
      .eq('team_id', game.home_team_id)
      .gt('minutes_played', 0)
      .order('minutes_played', { ascending: false });
      
    // Check away team  
    const { data: awayPlayers } = await supabase
      .from('player_game_logs')
      .select('player_id, minutes_played')
      .eq('game_id', game.id)
      .eq('team_id', game.away_team_id)
      .gt('minutes_played', 0)
      .order('minutes_played', { ascending: false });
      
    // Track by sport
    if (!sportBreakdown[game.sport]) {
      sportBreakdown[game.sport] = { total: 0, withEnough: 0 };
    }
    
    sportBreakdown[game.sport].total += 2;
    totalTeamGames += 2;
    
    // Track player count distribution
    const homeCount = homePlayers?.length || 0;
    const awayCount = awayPlayers?.length || 0;
    
    playerCountDistribution[homeCount] = (playerCountDistribution[homeCount] || 0) + 1;
    playerCountDistribution[awayCount] = (playerCountDistribution[awayCount] || 0) + 1;
    
    if (homeCount >= 5) {
      teamsWithEnoughPlayers++;
      sportBreakdown[game.sport].withEnough++;
    }
    if (awayCount >= 5) {
      teamsWithEnoughPlayers++;
      sportBreakdown[game.sport].withEnough++;
    }
  }
  
  console.log(`\nSample of ${sampleGames.length} games (${totalTeamGames} team-games):`);
  console.log(`- Team-games with 5+ players: ${chalk.green(teamsWithEnoughPlayers)}`);
  console.log(`- Percentage: ${chalk.green((teamsWithEnoughPlayers/totalTeamGames*100).toFixed(1) + '%')}`);
  
  console.log('\nBreakdown by sport:');
  for (const [sport, data] of Object.entries(sportBreakdown)) {
    const pct = (data.withEnough / data.total * 100).toFixed(1);
    console.log(`- ${sport}: ${chalk.yellow(data.withEnough)}/${data.total} (${chalk.green(pct + '%')})`);
  }
  
  console.log('\nPlayer count distribution:');
  const sortedCounts = Object.entries(playerCountDistribution)
    .sort(([a], [b]) => Number(b) - Number(a));
  for (const [count, teams] of sortedCounts) {
    console.log(`- ${count} players: ${teams} teams`);
  }
  
  // Calculate potential synergies
  console.log(chalk.cyan('\n📊 SYNERGY CALCULATION ISSUES:'));
  console.log(chalk.red('1. ❌ Code uses wrong column name: "minutes" instead of "minutes_played"'));
  console.log(chalk.yellow('2. ⚠️  Code limits to 500 games (should process all ' + totalGames + ')'));
  console.log(chalk.yellow('3. ⚠️  Only processes home teams (missing 50% of data)'));
  console.log(chalk.yellow('4. ⚠️  Requires EXACTLY 5 players (should be 5+)'));
  
  const estimatedRate = teamsWithEnoughPlayers / totalTeamGames;
  const estimatedTotalSynergies = Math.floor((totalGames || 0) * 2 * estimatedRate);
  
  console.log(chalk.cyan('\n💰 POTENTIAL SYNERGIES:'));
  console.log(`- Current implementation: ${chalk.red('775')} (broken)`)
  console.log(`- If fixed (all games + both teams + 5+ players): ${chalk.green('~' + estimatedTotalSynergies.toLocaleString())}`);
  console.log(`- Improvement: ${chalk.bold.green((estimatedTotalSynergies / 775).toFixed(0) + 'x more synergies!')}`);
  
  // Check unique lineups
  console.log(chalk.cyan('\n🎯 UNIQUE LINEUP POTENTIAL:'));
  
  // Sample a few teams to see lineup variety
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .in('sport', ['NBA', 'NFL'])
    .limit(5);
    
  if (teams) {
    for (const team of teams) {
      const { data: teamGames } = await supabase
        .from('games')
        .select('id')
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .not('home_score', 'is', null)
        .limit(10);
        
      if (teamGames) {
        const uniqueLineups = new Set<string>();
        
        for (const game of teamGames) {
          const { data: players } = await supabase
            .from('player_game_logs')
            .select('player_id')
            .eq('game_id', game.id)
            .eq('team_id', team.id)
            .gt('minutes_played', 0)
            .order('minutes_played', { ascending: false })
            .limit(5);
            
          if (players && players.length === 5) {
            const lineup = players.map(p => p.player_id).sort().join(',');
            uniqueLineups.add(lineup);
          }
        }
        
        console.log(`- ${team.name} (${team.sport}): ${uniqueLineups.size} unique lineups in 10 games`);
      }
    }
  }
}

analyzeActualSynergies().catch(console.error);