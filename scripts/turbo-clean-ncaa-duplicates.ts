#!/usr/bin/env tsx
/**
 * 🚀 TURBO NCAA DUPLICATE CLEANUP - 10X PERFORMANCE
 * 
 * Uses all CPU cores and RAM to clean duplicates fast!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length;
const BATCH_SIZE = 50; // Delete in batches to avoid timeout
const dbLimit = pLimit(CPU_CORES); // Use all cores for parallel DB operations

console.log(chalk.cyan('🚀 TURBO NCAA CLEANUP'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores`));
console.log(chalk.gray(`   RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`));
console.log(chalk.gray(`   Batch Size: ${BATCH_SIZE} teams per batch`));

async function turboCleanNCAADuplicates() {
  const startTime = Date.now();
  
  // 1. Get all duplicate teams
  console.log(chalk.yellow('\n📊 Analyzing duplicates...'));
  
  const { data: duplicateTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .in('sport', ['NCAAF', 'NCAAB']);
    
  if (!duplicateTeams || duplicateTeams.length === 0) {
    console.log(chalk.green('✅ No duplicates found!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${duplicateTeams.length} duplicate teams to clean`));
  
  // Group by sport for summary
  const bySport = duplicateTeams.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });
  
  // 2. Check for any games/stats/players referencing these teams
  console.log(chalk.yellow('\n🔍 Checking references...'));
  
  const teamIds = duplicateTeams.map(t => t.id);
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
    batches.push(teamIds.slice(i, i + BATCH_SIZE));
  }
  
  // Check for references in parallel
  const checkPromises = batches.map(batch => 
    dbLimit(async () => {
      const { count: gameCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`home_team_id.in.(${batch.join(',')}),away_team_id.in.(${batch.join(',')})`);
        
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .in('team_id', batch);
        
      return { gameCount: gameCount || 0, playerCount: playerCount || 0 };
    })
  );
  
  const results = await Promise.all(checkPromises);
  const totalGames = results.reduce((sum, r) => sum + r.gameCount, 0);
  const totalPlayers = results.reduce((sum, r) => sum + r.playerCount, 0);
  
  console.log(`  Games referencing old teams: ${totalGames}`);
  console.log(`  Players referencing old teams: ${totalPlayers}`);
  
  if (totalGames > 0 || totalPlayers > 0) {
    console.log(chalk.red('⚠️  Cannot delete teams with existing references!'));
    console.log(chalk.yellow('Need to update references first'));
    return;
  }
  
  // 3. Delete teams in parallel batches
  console.log(chalk.yellow('\n🗑️  Deleting duplicate teams...'));
  
  const deletePromises = batches.map((batch, index) => 
    dbLimit(async () => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .in('id', batch);
        
      if (error) {
        console.error(chalk.red(`Batch ${index + 1} error:`), error.message);
        return 0;
      }
      
      process.stdout.write(`\r  Deleted batch ${index + 1}/${batches.length} (${batch.length} teams)`);
      return batch.length;
    })
  );
  
  const deletedCounts = await Promise.all(deletePromises);
  const totalDeleted = deletedCounts.reduce((sum, count) => sum + count, 0);
  
  console.log(chalk.green(`\n✅ Deleted ${totalDeleted} duplicate teams`));
  
  // 4. Verify final state
  const { data: finalTeams } = await supabase
    .from('teams')
    .select('sport')
    .ilike('sport', 'NCAA%');
    
  const finalCounts = finalTeams?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log(chalk.green('\n🏁 CLEANUP COMPLETE!'));
  console.log(chalk.cyan('\nFinal NCAA teams:'));
  Object.entries(finalCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });
  console.log(chalk.gray(`\n⏱️  Time: ${elapsed.toFixed(1)}s`));
  console.log(chalk.gray(`🚀 Speed: ${Math.round(duplicateTeams.length / elapsed)} teams/sec`));
}

turboCleanNCAADuplicates().catch(console.error);