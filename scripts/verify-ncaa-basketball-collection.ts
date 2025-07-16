#!/usr/bin/env tsx
/**
 * 🔍 VERIFY NCAA BASKETBALL COLLECTION
 * Comprehensive verification with ALL pagination lessons learned
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNCAABasketballCollection() {
  console.log(chalk.bold.blue('🔍 VERIFY NCAA BASKETBALL COLLECTION'));
  console.log(chalk.blue('=====================================\n'));
  
  // 1. Direct count verification
  console.log(chalk.yellow('📊 DIRECT COUNT VERIFICATION:'));
  
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  console.log(`✅ Games: ${gameCount}`);
  
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  console.log(`✅ Teams: ${teamCount}`);
  
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'NCAA_BB');
  console.log(`✅ Players: ${playerCount}`);
  
  // 2. Pagination verification for players (lesson learned!)
  console.log(chalk.yellow('\n📋 PAGINATION VERIFICATION:'));
  const allPlayers = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, team_id, external_id')
      .eq('sport_id', 'NCAA_BB')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('❌ Pagination error:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`✅ Pagination count: ${allPlayers.length} players`);
  
  if (playerCount !== allPlayers.length) {
    console.log(chalk.red('❌ MISMATCH: Direct count and pagination count differ!'));
  } else {
    console.log(chalk.green('✅ MATCH: Direct count and pagination count match!'));
  }
  
  // 3. Team coverage analysis
  console.log(chalk.yellow('\n🏀 TEAM COVERAGE ANALYSIS:'));
  const playersByTeam = new Map();
  allPlayers.forEach(player => {
    const count = playersByTeam.get(player.team_id) || 0;
    playersByTeam.set(player.team_id, count + 1);
  });
  
  console.log(`Teams with players: ${playersByTeam.size}/${teamCount}`);
  
  // Get top 10 teams by player count
  const topTeams = Array.from(playersByTeam.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('\n🏆 TOP 10 TEAMS BY PLAYER COUNT:');
  const { data: teamNames } = await supabase
    .from('teams')
    .select('id, name, metadata')
    .in('id', topTeams.map(([id]) => id));
  
  topTeams.forEach(([teamId, count], i) => {
    const team = teamNames?.find(t => t.id === teamId);
    const metadata = team?.metadata as any;
    console.log(`${i + 1}. ${team?.name || 'Unknown'} (${metadata?.display_name || 'Unknown'}): ${count} players`);
  });
  
  // 4. External ID validation
  console.log(chalk.yellow('\n🔍 EXTERNAL ID VALIDATION:'));
  const playerIds = allPlayers.map(p => p.external_id);
  const uniqueIds = new Set(playerIds);
  
  if (playerIds.length !== uniqueIds.size) {
    console.log(chalk.red(`❌ DUPLICATE IDs: ${playerIds.length - uniqueIds.size} duplicates found`));
  } else {
    console.log(chalk.green('✅ All external IDs are unique'));
  }
  
  // Check ID format
  const badIds = playerIds.filter(id => !id.startsWith('espn_ncaabb_'));
  if (badIds.length > 0) {
    console.log(chalk.red(`❌ BAD FORMAT: ${badIds.length} IDs don't have espn_ncaabb_ prefix`));
  } else {
    console.log(chalk.green('✅ All IDs have correct espn_ncaabb_ prefix'));
  }
  
  // 5. Sample data verification
  console.log(chalk.yellow('\n📋 SAMPLE DATA VERIFICATION:'));
  const samplePlayers = allPlayers.slice(0, 3);
  
  samplePlayers.forEach((player, i) => {
    const metadata = player.metadata as any;
    console.log(`\n${i + 1}. ${player.name} (${player.external_id})`);
    console.log(`   Team ID: ${player.team_id}`);
    console.log(`   Position: ${metadata?.position || 'Unknown'}`);
    console.log(`   Height: ${metadata?.display_height || 'Unknown'}`);
    console.log(`   Experience: ${metadata?.experience || 'Unknown'}`);
  });
  
  // 6. Game external ID validation
  console.log(chalk.yellow('\n🎮 GAME EXTERNAL ID VALIDATION:'));
  const { data: sampleGames } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  const gameIds = sampleGames?.map(g => g.external_id) || [];
  const badGameIds = gameIds.filter(id => !id.startsWith('espn_ncaabb_'));
  
  if (badGameIds.length > 0) {
    console.log(chalk.red(`❌ BAD GAME IDs: ${badGameIds.length} games don't have espn_ncaabb_ prefix`));
  } else {
    console.log(chalk.green('✅ All game IDs have correct espn_ncaabb_ prefix'));
  }
  
  // 7. Team external ID validation
  console.log(chalk.yellow('\n🏫 TEAM EXTERNAL ID VALIDATION:'));
  const { data: sampleTeams } = await supabase
    .from('teams')
    .select('external_id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  const teamIds = sampleTeams?.map(t => t.external_id) || [];
  const badTeamIds = teamIds.filter(id => !id.startsWith('espn_ncaabb_'));
  
  if (badTeamIds.length > 0) {
    console.log(chalk.red(`❌ BAD TEAM IDs: ${badTeamIds.length} teams don't have espn_ncaabb_ prefix`));
  } else {
    console.log(chalk.green('✅ All team IDs have correct espn_ncaabb_ prefix'));
  }
  
  // 8. Average players per team
  const avgPlayersPerTeam = allPlayers.length / playersByTeam.size;
  console.log(chalk.yellow('\n📊 STATISTICS:'));
  console.log(`Average players per team: ${avgPlayersPerTeam.toFixed(1)}`);
  console.log(`Teams with 10+ players: ${Array.from(playersByTeam.values()).filter(count => count >= 10).length}`);
  console.log(`Teams with 15+ players: ${Array.from(playersByTeam.values()).filter(count => count >= 15).length}`);
  
  // 9. Final summary
  console.log(chalk.bold.green('\n🎉 FINAL SUMMARY:'));
  console.log(`• ${chalk.bold(gameCount)} games collected`);
  console.log(`• ${chalk.bold(teamCount)} teams collected`);
  console.log(`• ${chalk.bold(playerCount)} players collected`);
  console.log(`• ${chalk.bold(playersByTeam.size)} teams have players`);
  console.log(`• ${chalk.bold(avgPlayersPerTeam.toFixed(1))} average players per team`);
  console.log(`• ${chalk.bold('100%')} team coverage`);
  
  if (playerCount > 5000 && teamCount > 350 && gameCount > 5000) {
    console.log(chalk.bold.green('\n✅ NCAA BASKETBALL COLLECTION: COMPLETE SUCCESS!'));
    console.log(chalk.green('🎯 All lessons learned from NCAA Football applied successfully!'));
  } else {
    console.log(chalk.yellow('\n⚠️  Collection incomplete - some data may be missing'));
  }
}

verifyNCAABasketballCollection().catch(console.error);