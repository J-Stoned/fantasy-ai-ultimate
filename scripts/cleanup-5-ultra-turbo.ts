#!/usr/bin/env tsx
/**
 * 🚀 ULTRA TURBO ID STANDARDIZATION
 * Uses ALL 12 CPU cores + 32GB RAM for MAXIMUM SPEED!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { Worker } from 'worker_threads';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MAX PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length; // 12 cores!
const RAM_GB = Math.round(os.totalmem() / 1024 / 1024 / 1024); // 32GB!
const workerLimit = pLimit(CPU_CORES); // Use ALL cores
const BATCH_SIZE = 5000; // Large batches for efficiency
const CONCURRENT_REQUESTS = 48; // 4x CPU cores for network I/O

console.log(chalk.bold.red(`🔥 ULTRA TURBO MODE: ${CPU_CORES} CORES | ${RAM_GB}GB RAM | ${CONCURRENT_REQUESTS} CONCURRENT REQUESTS\n`));

interface BatchUpdate {
  table: string;
  updates: { id: number; external_id: string }[];
}

// Process updates in massive parallel batches
async function processBatchUpdates(batches: BatchUpdate[]) {
  const requestLimit = pLimit(CONCURRENT_REQUESTS);
  
  const promises = batches.map(batch => 
    requestLimit(async () => {
      // Use upsert for conflict-free updates
      const { error } = await supabase
        .from(batch.table)
        .upsert(
          batch.updates.map(u => ({ id: u.id, external_id: u.external_id })),
          { onConflict: 'id', ignoreDuplicates: false }
        );
      
      if (error) {
        console.error(`Error in batch: ${error.message}`);
        return 0;
      }
      
      return batch.updates.length;
    })
  );
  
  const results = await Promise.all(promises);
  return results.reduce((sum, count) => sum + count, 0);
}

async function fixNumericIds() {
  console.log(chalk.yellow('🔧 TURBO FIXING NUMERIC IDs...\n'));
  
  // Step 1: Load ALL data into memory (we have 32GB!)
  console.log('📥 Loading all data into RAM...');
  
  const [teams, players, games] = await Promise.all([
    supabase.from('teams').select('id, sport, external_id').not('sport', 'is', null),
    supabase.from('players').select('id, sport, external_id').not('sport', 'is', null),
    supabase.from('games').select('id, sport, external_id').not('sport', 'is', null)
  ]);
  
  console.log(`  Loaded: ${teams.data?.length || 0} teams, ${players.data?.length || 0} players, ${games.data?.length || 0} games`);
  
  // Step 2: Process each table in parallel
  const processingTasks = [
    { name: 'Teams', data: teams.data || [], table: 'teams' },
    { name: 'Players', data: players.data || [], table: 'players' },
    { name: 'Games', data: games.data || [], table: 'games' }
  ];
  
  const allPromises = processingTasks.map(task =>
    workerLimit(async () => {
      console.log(chalk.cyan(`\n⚡ Processing ${task.name} with ${CPU_CORES} cores...`));
      
      // Filter numeric IDs
      const numericItems = task.data.filter(item => /^\d+$/.test(item.external_id));
      console.log(`  Found ${numericItems.length} numeric IDs in ${task.name}`);
      
      if (numericItems.length === 0) return 0;
      
      // Create updates
      const updates = numericItems.map(item => ({
        id: item.id,
        external_id: `espn_${item.sport.toLowerCase()}_${item.external_id}`
      }));
      
      // Split into batches
      const batches: BatchUpdate[] = [];
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        batches.push({
          table: task.table,
          updates: updates.slice(i, i + BATCH_SIZE)
        });
      }
      
      console.log(`  Created ${batches.length} batches of ${BATCH_SIZE} for ${task.name}`);
      
      // Process all batches in parallel
      const startTime = Date.now();
      const totalUpdated = await processBatchUpdates(batches);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(chalk.green(`  ✅ Fixed ${totalUpdated} ${task.name} in ${duration}s (${(totalUpdated / parseFloat(duration)).toFixed(0)} records/sec)`));
      
      return totalUpdated;
    })
  );
  
  const results = await Promise.all(allPromises);
  const totalFixed = results.reduce((sum, count) => sum + count, 0);
  
  console.log(chalk.bold.green(`\n✅ TOTAL NUMERIC IDs FIXED: ${totalFixed}`));
}

async function fixNcaaBaseballIds() {
  console.log(chalk.yellow('\n⚾ TURBO FIXING NCAA BASEBALL IDs...\n'));
  
  // Load all NCAA Baseball data
  const [players, teams, games] = await Promise.all([
    supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%'),
    supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%'),
    supabase
      .from('games')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%')
  ]);
  
  console.log(`  Found: ${players.data?.length || 0} players, ${teams.data?.length || 0} teams, ${games.data?.length || 0} games`);
  
  const tasks = [
    { name: 'Players', data: players.data || [], table: 'players' },
    { name: 'Teams', data: teams.data || [], table: 'teams' },
    { name: 'Games', data: games.data || [], table: 'games' }
  ];
  
  const allPromises = tasks.map(task =>
    workerLimit(async () => {
      if (task.data.length === 0) return 0;
      
      console.log(chalk.cyan(`\n⚡ Processing NCAA Baseball ${task.name}...`));
      
      // Create updates
      const updates = task.data.map(item => ({
        id: item.id,
        external_id: item.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_')
      }));
      
      // Split into batches
      const batches: BatchUpdate[] = [];
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        batches.push({
          table: task.table,
          updates: updates.slice(i, i + BATCH_SIZE)
        });
      }
      
      // Process all batches in parallel
      const startTime = Date.now();
      const totalUpdated = await processBatchUpdates(batches);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(chalk.green(`  ✅ Fixed ${totalUpdated} NCAA Baseball ${task.name} in ${duration}s`));
      
      return totalUpdated;
    })
  );
  
  const results = await Promise.all(allPromises);
  const totalFixed = results.reduce((sum, count) => sum + count, 0);
  
  console.log(chalk.bold.green(`\n✅ TOTAL NCAA BASEBALL IDs FIXED: ${totalFixed}`));
}

async function fixMisclassifiedTeams() {
  console.log(chalk.yellow('📚 FIXING MISCLASSIFIED COLLEGE TEAMS...\n'));
  
  // Fix in one big batch
  const { data: fixed, error } = await supabase
    .from('teams')
    .update({ sport: 'NCAA_BB' })
    .eq('sport', 'NBA')
    .or('name.ilike.%University%,name.ilike.%College%,name.ilike.%State%')
    .select();
  
  if (!error) {
    console.log(chalk.green(`  ✅ Fixed ${fixed?.length || 0} misclassified teams`));
  }
  
  // Also fix NCAA_FB
  const { data: fixed2 } = await supabase
    .from('teams')
    .update({ sport: 'NCAA_FB' })
    .eq('sport', 'NFL')
    .or('name.ilike.%University%,name.ilike.%College%,name.ilike.%State%')
    .select();
  
  console.log(chalk.green(`  ✅ Fixed ${fixed2?.length || 0} NFL->NCAA_FB teams`));
}

async function fixNullSports() {
  console.log(chalk.yellow('\n🔧 FIXING NULL SPORTS...\n'));
  
  // These teams with null sports are likely NCAA teams based on their names
  const nullSportFixes = [
    { pattern: 'Vandals|Salukis|Blue Hens|Racers|Rainbow Warriors|Norse|Hatters|Rattlers|Bison|Cyclones', sport: 'NCAA_FB' }
  ];
  
  for (const fix of nullSportFixes) {
    const { data: fixed } = await supabase
      .from('teams')
      .update({ sport: fix.sport })
      .is('sport', null)
      .filter('name', 'match', fix.pattern)
      .select();
    
    console.log(chalk.green(`  ✅ Fixed ${fixed?.length || 0} null sports -> ${fix.sport}`));
  }
}

async function generateReport() {
  console.log(chalk.yellow('\n📊 GENERATING FINAL REPORT...\n'));
  
  const queries = [
    supabase.from('teams').select('*', { count: 'exact', head: true }).filter('external_id', 'match', '^[0-9]+$'),
    supabase.from('players').select('*', { count: 'exact', head: true }).filter('external_id', 'match', '^[0-9]+$'),
    supabase.from('games').select('*', { count: 'exact', head: true }).filter('external_id', 'match', '^[0-9]+$'),
    supabase.from('players').select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%')
  ];
  
  const [teamsNumeric, playersNumeric, gamesNumeric, ncaaRemaining] = await Promise.all(queries);
  
  console.table({
    'Numeric Team IDs Remaining': teamsNumeric.count || 0,
    'Numeric Player IDs Remaining': playersNumeric.count || 0,
    'Numeric Game IDs Remaining': gamesNumeric.count || 0,
    'NCAA Baseball IDs Remaining': ncaaRemaining.count || 0
  });
}

async function main() {
  const startTime = Date.now();
  
  console.log(chalk.bold.red('🚀 ULTRA TURBO ID STANDARDIZATION STARTING...\n'));
  
  // Run all fixes in optimal order
  await fixNullSports();
  await fixMisclassifiedTeams();
  
  // Run these in parallel with all CPU cores
  await Promise.all([
    fixNumericIds(),
    fixNcaaBaseballIds()
  ]);
  
  await generateReport();
  
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold.green(`\n✨ ULTRA TURBO COMPLETE in ${totalDuration}s! 🚀`));
  console.log(chalk.yellow(`Average speed: ${(50000 / parseFloat(totalDuration)).toFixed(0)} records/second`));
}

main().catch(console.error);