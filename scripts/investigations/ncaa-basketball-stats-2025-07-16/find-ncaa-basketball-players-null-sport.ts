#!/usr/bin/env tsx
/**
 * 🔍 FIND NCAA BASKETBALL PLAYERS WITH NULL SPORT
 * Check if NCAA BB players have null sport field
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findNCAABasketballPlayersNullSport() {
  console.log(chalk.bold.blue('🔍 FINDING NCAA BASKETBALL PLAYERS WITH NULL SPORT\n'));
  
  // 1. Count players by sport including null
  console.log(chalk.yellow('1. Players by sport:'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', null];
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    console.log(`${sport || 'NULL'}: ${count?.toLocaleString() || 0} players`);
  }
  
  // 2. Check players with null sport
  console.log(chalk.yellow('\n2. Analyzing players with NULL sport:'));
  
  const { data: nullSportPlayers } = await supabase
    .from('players')
    .select('id, name, external_id, team_id')
    .is('sport', null)
    .limit(20);
  
  console.log(`\nSample players with NULL sport:`);
  nullSportPlayers?.forEach((player, i) => {
    console.log(`${i + 1}. ${player.name} (ID: ${player.id}, External: ${player.external_id || 'none'})`);
  });
  
  // 3. Check if these are the players linked to NCAA BB stats
  console.log(chalk.yellow('\n3. Checking if NULL sport players have NCAA BB stats:'));
  
  if (nullSportPlayers && nullSportPlayers.length > 0) {
    const playerIds = nullSportPlayers.slice(0, 5).map(p => p.id);
    
    for (const playerId of playerIds) {
      const { data: stats } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .eq('player_id', playerId)
        .limit(1);
      
      if (stats && stats.length > 0) {
        const { data: game } = await supabase
          .from('games')
          .select('sport, external_id')
          .eq('id', stats[0].game_id)
          .single();
        
        const { data: player } = await supabase
          .from('players')
          .select('name')
          .eq('id', playerId)
          .single();
        
        console.log(`Player ${player?.name} has stats for ${game?.sport} game (${game?.external_id})`);
      }
    }
  }
  
  // 4. Check team associations
  console.log(chalk.yellow('\n4. Checking team associations for NULL sport players:'));
  
  const { data: teamsWithNullPlayers } = await supabase
    .from('players')
    .select('team_id')
    .is('sport', null)
    .not('team_id', 'is', null)
    .limit(100);
  
  if (teamsWithNullPlayers && teamsWithNullPlayers.length > 0) {
    const uniqueTeamIds = [...new Set(teamsWithNullPlayers.map(p => p.team_id))].slice(0, 10);
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, sport')
      .in('id', uniqueTeamIds);
    
    console.log('\nTeams for NULL sport players:');
    teams?.forEach(team => {
      console.log(`Team: ${team.name} (${team.sport})`);
    });
  }
  
  // 5. Check external_id patterns
  console.log(chalk.yellow('\n5. External ID patterns for NULL sport players:'));
  
  const { data: externalIds } = await supabase
    .from('players')
    .select('external_id')
    .is('sport', null)
    .not('external_id', 'is', null)
    .limit(50);
  
  const patterns: Record<string, number> = {};
  externalIds?.forEach(({ external_id }) => {
    if (external_id) {
      const pattern = external_id.split('_')[0];
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }
  });
  
  console.log('External ID patterns:');
  Object.entries(patterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });
  
  // 6. Final count
  console.log(chalk.bold.green('\n📊 SUMMARY:'));
  
  const { count: totalNullSport } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  console.log(`Total players with NULL sport: ${totalNullSport?.toLocaleString()}`);
  
  // Check if this matches our expected NCAA BB players
  if (totalNullSport && totalNullSport > 5000) {
    console.log(chalk.red(`\n⚠️  FOUND THE ISSUE!`));
    console.log(chalk.red(`These ${totalNullSport.toLocaleString()} players with NULL sport are likely NCAA Basketball players!`));
    console.log(chalk.yellow(`\nWe need to update these players to have sport = 'NCAA_BB'`));
  }
}

findNCAABasketballPlayersNullSport().catch(console.error);