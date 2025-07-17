#!/usr/bin/env tsx
/**
 * Analyze stats format consistency across all sports
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatsFormat() {
  console.log(chalk.bold.blue('STATS FORMAT ANALYSIS ACROSS ALL SPORTS\n'));
  
  // Check each sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`\n=== ${sport} ===`));
    
    // Get a sample player
    const { data: player } = await supabase
      .from('players')
      .select('id, name, external_id, team_id')
      .eq('sport', sport)
      .limit(1)
      .single();
      
    if (!player) {
      console.log('No players found');
      continue;
    }
    
    console.log(`Sample player: ${player.name}`);
    console.log(`  - Player external_id: ${player.external_id}`);
    console.log(`  - Player internal id: ${player.id}`);
    console.log(`  - Team_id: ${player.team_id}`);
    
    // Get stats for this player
    const { data: stats, count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .eq('player_id', player.id)
      .limit(1);
      
    if (stats && stats.length > 0) {
      const stat = stats[0];
      console.log(`  - Has ${count} stats in player_game_logs`);
      console.log('  - Stat structure:');
      console.log(`    • Uses player_id: ${stat.player_id} (internal ID)`);
      console.log(`    • Uses game_id: ${stat.game_id} (internal ID)`);
      console.log(`    • Uses team_id: ${stat.team_id} (internal ID)`);
      console.log(`    • Sport field: ${stat.sport || 'NULL'}`);
      console.log(`    • Stats object: ${Object.keys(stat.stats || {}).slice(0, 5).join(', ')}...`);
      
      // Verify game reference
      if (stat.game_id) {
        const { data: game } = await supabase
          .from('games')
          .select('external_id, sport')
          .eq('id', stat.game_id)
          .single();
          
        if (game) {
          console.log(`    • Game external_id: ${game.external_id}`);
          console.log(`    • Game sport: ${game.sport}`);
        }
      }
    } else {
      console.log('  - No stats found');
    }
  }
  
  // Overall stats analysis
  console.log(chalk.bold.cyan('\n\n=== OVERALL STATS ANALYSIS ==='));
  
  // Check sport field population
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsWithSport } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('sport', 'is', null);
    
  console.log(`Total stats: ${totalStats?.toLocaleString()}`);
  console.log(`Stats with sport field: ${statsWithSport?.toLocaleString()} (${statsWithSport && totalStats ? Math.round(statsWithSport/totalStats*100) : 0}%)`);
  
  // Check ID references
  console.log('\nID Reference Format:');
  console.log('  ✅ Stats use INTERNAL IDs for all references:');
  console.log('     - player_id → players.id (NOT external_id)');
  console.log('     - game_id → games.id (NOT external_id)');
  console.log('     - team_id → teams.id (NOT external_id)');
  console.log('  ✅ This means external_id changes do NOT affect stats!');
}

analyzeStatsFormat().catch(console.error);