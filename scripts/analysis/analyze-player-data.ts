#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE PLAYER DATA FOR ML FEATURES
 * Phase 2: Understanding what player-level features we can extract
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzePlayerData() {
  console.log(chalk.bold.cyan('🔍 ANALYZING PLAYER DATA FOR ML FEATURES\n'));
  
  // Check player stats table
  const { data: playerStats, count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.green(`📊 Player Stats: ${statsCount} records`));
  
  // Sample player stats
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(3);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.yellow('\nSample player stat record:'));
    console.log(JSON.stringify(sampleStats[0], null, 2));
    
    console.log(chalk.yellow('\nAvailable stat fields:'));
    Object.keys(sampleStats[0]).forEach(key => {
      console.log(`  - ${key}`);
    });
  }
  
  // Check player injuries
  const { data: injuries, count: injuryCount } = await supabase
    .from('player_injuries')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.green(`\n🏥 Player Injuries: ${injuryCount} records`));
  
  // Sample injury
  const { data: sampleInjury } = await supabase
    .from('player_injuries')
    .select('*')
    .limit(1);
    
  if (sampleInjury && sampleInjury.length > 0) {
    console.log(chalk.yellow('\nSample injury record:'));
    console.log(JSON.stringify(sampleInjury[0], null, 2));
  }
  
  // Check players table
  const { data: players, count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.green(`\n👥 Total Players: ${playerCount} records`));
  
  // Sample player record
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('*')
    .limit(1);
    
  if (samplePlayer && samplePlayer.length > 0) {
    console.log(chalk.yellow('\nSample player record:'));
    console.log(JSON.stringify(samplePlayer[0], null, 2));
  }
  
  // Analyze team composition
  console.log(chalk.bold.cyan('\n🏀 TEAM COMPOSITION ANALYSIS'));
  
  const { data: teamPlayers } = await supabase
    .from('players')
    .select('team_id')
    .not('team_id', 'is', null);
    
  if (teamPlayers) {
    const teamCounts = teamPlayers.reduce((acc, player) => {
      acc[player.team_id] = (acc[player.team_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgPlayersPerTeam = Object.values(teamCounts).reduce((a, b) => a + b, 0) / Object.keys(teamCounts).length;
    console.log(`Average players per team: ${avgPlayersPerTeam.toFixed(1)}`);
    console.log(`Teams with players: ${Object.keys(teamCounts).length}`);
  }
  
  // Most valuable features we can extract
  console.log(chalk.bold.yellow('\n⭐ KEY PLAYER FEATURES WE CAN EXTRACT:'));
  console.log('1. Top player fantasy points per team');
  console.log('2. Star player availability (injury status)');
  console.log('3. Team depth (number of active players)'); 
  console.log('4. Average fantasy points per position');
  console.log('5. Player momentum/form trends');
  console.log('6. Injury impact on starting lineup');
  console.log('7. Player efficiency ratings');
  console.log('8. Bench strength vs starters');
  
  console.log(chalk.bold.green('\n✅ Player data analysis complete!'));
  console.log(chalk.gray('Ready to integrate player features into ML models...'));
}

analyzePlayerData().catch(console.error);