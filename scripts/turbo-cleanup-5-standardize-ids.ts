#!/usr/bin/env tsx
/**
 * 🚀 TURBO ID STANDARDIZATION - PARALLEL PROCESSING
 * 
 * Leverages Ryzen 5 7600X (12 cores) + 32GB RAM
 * Uses pagination and batch processing to avoid timeouts
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import * as cliProgress from 'cli-progress';
import os from 'os';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Performance settings
const CPU_CORES = os.cpus().length;
const RAM_GB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
const dbLimit = pLimit(4); // Limit concurrent DB connections
const workerLimit = pLimit(CPU_CORES); // Use all CPU cores

// Progress tracking
const multibar = new cliProgress.MultiBar({
  format: '{name} |{bar}| {percentage}% | ETA: {eta}s | {value}/{total}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

interface ConflictMap {
  [key: string]: boolean;
}

async function loadExistingIds(table: string): Promise<ConflictMap> {
  const conflictMap: ConflictMap = {};
  let offset = 0;
  const pageSize = 10000;
  
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('external_id')
      .not('external_id', 'is', null)
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    data.forEach(row => {
      conflictMap[row.external_id] = true;
    });
    
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  
  return conflictMap;
}

async function fixMisclassifiedTeams() {
  console.log(chalk.yellow('\n📋 Step 1: Fixing misclassified college teams...'));
  
  // Fix NBA -> NCAA_BB
  const collegePatterns = [
    'name.ilike.%University%',
    'name.ilike.%College%', 
    'name.ilike.%State%',
    'name.in.(UCLA Bruins,Auburn Tigers,Arkansas Razorbacks,USC Trojans,Arizona State Sun Devils,UAB Blazers,Stanford Cardinal,UC San Diego Tritons,California Golden Bears,Boston College Eagles)'
  ];
  
  const { data: nbaFix, error: err1 } = await supabase
    .from('teams')
    .update({ sport: 'NCAA_BB' })
    .eq('sport', 'NBA')
    .or(collegePatterns.join(','))
    .select();
  
  if (err1) throw err1;
  console.log(`  ✅ Fixed ${nbaFix?.length || 0} NBA -> NCAA_BB teams`);
  
  // Fix NFL -> NCAA_FB
  const { data: nflFix, error: err2 } = await supabase
    .from('teams')
    .update({ sport: 'NCAA_FB' })
    .eq('sport', 'NFL')
    .or('name.ilike.%University%,name.ilike.%College%,name.ilike.%State%')
    .select();
  
  if (err2) throw err2;
  console.log(`  ✅ Fixed ${nflFix?.length || 0} NFL -> NCAA_FB teams`);
}

async function standardizeTeamIds() {
  console.log(chalk.yellow('\n🏢 Step 2: Standardizing team IDs...'));
  
  // Load existing IDs to check for conflicts
  const existingIds = await loadExistingIds('teams');
  
  // Get all teams with numeric IDs
  const { data: numericTeams, error } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .not('external_id', 'is', null)
    .not('sport', 'is', null);
  
  if (error) throw error;
  
  const teamsToUpdate = numericTeams?.filter(t => /^\d+$/.test(t.external_id)) || [];
  console.log(`  Found ${teamsToUpdate.length} teams with numeric IDs`);
  
  if (teamsToUpdate.length === 0) return;
  
  const progressBar = multibar.create(teamsToUpdate.length, 0, { name: 'Teams' });
  
  // Process in batches
  const batchSize = 100;
  const updates: any[] = [];
  
  for (const team of teamsToUpdate) {
    const proposedId = `espn_${team.sport.toLowerCase()}_${team.external_id}`;
    
    if (!existingIds[proposedId]) {
      updates.push({
        id: team.id,
        external_id: proposedId
      });
    }
    
    progressBar.increment();
  }
  
  // Apply updates in batches
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(update =>
        dbLimit(() =>
          supabase
            .from('teams')
            .update({ external_id: update.external_id })
            .eq('id', update.id)
        )
      )
    );
  }
  
  progressBar.stop();
  console.log(`  ✅ Updated ${updates.length} team IDs`);
}

async function standardizePlayerIds() {
  console.log(chalk.yellow('\n👥 Step 3: Standardizing player IDs...'));
  
  // Count total players with numeric IDs
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null)
    .not('sport', 'is', null)
    .filter('external_id', 'match', '^[0-9]+$');
  
  console.log(`  Found ${totalCount || 0} players with numeric IDs`);
  
  if (!totalCount || totalCount === 0) return;
  
  const progressBar = multibar.create(totalCount, 0, { name: 'Players' });
  
  // Load existing IDs
  const existingIds = await loadExistingIds('players');
  
  // Process with pagination
  const pageSize = 1000;
  const pages = Math.ceil(totalCount / pageSize);
  let totalUpdated = 0;
  
  for (let page = 0; page < pages; page++) {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, sport, external_id')
      .not('external_id', 'is', null)
      .not('sport', 'is', null)
      .filter('external_id', 'match', '^[0-9]+$')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    if (!players || players.length === 0) continue;
    
    const updates: any[] = [];
    
    for (const player of players) {
      const proposedId = `espn_${player.sport.toLowerCase()}_${player.external_id}`;
      
      if (!existingIds[proposedId]) {
        updates.push({
          id: player.id,
          external_id: proposedId
        });
        existingIds[proposedId] = true; // Prevent duplicates in same batch
      }
      
      progressBar.increment();
    }
    
    // Apply updates for this page
    if (updates.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(update =>
            dbLimit(() =>
              supabase
                .from('players')
                .update({ external_id: update.external_id })
                .eq('id', update.id)
            )
          )
        );
      }
      
      totalUpdated += updates.length;
    }
  }
  
  progressBar.stop();
  console.log(`  ✅ Updated ${totalUpdated} player IDs`);
}

async function standardizeGameIds() {
  console.log(chalk.yellow('\n🎮 Step 4: Standardizing game IDs...'));
  
  // Count total games with numeric IDs
  const { count: totalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null)
    .not('sport', 'is', null)
    .filter('external_id', 'match', '^[0-9]+$');
  
  console.log(`  Found ${totalCount || 0} games with numeric IDs`);
  
  if (!totalCount || totalCount === 0) return;
  
  const progressBar = multibar.create(totalCount, 0, { name: 'Games' });
  
  // Load existing IDs
  const existingIds = await loadExistingIds('games');
  
  // Process with pagination
  const pageSize = 1000;
  const pages = Math.ceil(totalCount / pageSize);
  let totalUpdated = 0;
  
  for (let page = 0; page < pages; page++) {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, sport, external_id')
      .not('external_id', 'is', null)
      .not('sport', 'is', null)
      .filter('external_id', 'match', '^[0-9]+$')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    if (!games || games.length === 0) continue;
    
    const updates: any[] = [];
    
    for (const game of games) {
      const proposedId = `espn_${game.sport.toLowerCase()}_${game.external_id}`;
      
      if (!existingIds[proposedId]) {
        updates.push({
          id: game.id,
          external_id: proposedId
        });
        existingIds[proposedId] = true;
      }
      
      progressBar.increment();
    }
    
    // Apply updates
    if (updates.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(update =>
            dbLimit(() =>
              supabase
                .from('games')
                .update({ external_id: update.external_id })
                .eq('id', update.id)
            )
          )
        );
      }
      
      totalUpdated += updates.length;
    }
  }
  
  progressBar.stop();
  console.log(`  ✅ Updated ${totalUpdated} game IDs`);
}

async function fixNcaaBaseballIds() {
  console.log(chalk.yellow('\n⚾ Step 5: Fixing NCAA Baseball IDs...'));
  
  // Process each table
  const tables = ['players', 'teams', 'games'];
  
  for (const table of tables) {
    console.log(`  Processing ${table}...`);
    
    // Count items needing fix
    const { count: totalCount } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%');
    
    if (!totalCount || totalCount === 0) {
      console.log(`    No ${table} need fixing`);
      continue;
    }
    
    console.log(`    Found ${totalCount} ${table} to fix`);
    
    const progressBar = multibar.create(totalCount, 0, { name: `NCAA ${table}` });
    
    // Load existing IDs
    const existingIds = await loadExistingIds(table);
    
    // Process with pagination
    const pageSize = 500;
    const pages = Math.ceil(totalCount / pageSize);
    let totalUpdated = 0;
    
    for (let page = 0; page < pages; page++) {
      const { data: items, error } = await supabase
        .from(table)
        .select('id, external_id')
        .eq('sport', 'NCAA_BASEBALL')
        .like('external_id', 'espn_ncaa_%')
        .not('external_id', 'like', 'espn_ncaa_baseball_%')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      if (!items || items.length === 0) continue;
      
      const updates: any[] = [];
      
      for (const item of items) {
        const newId = item.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
        
        if (!existingIds[newId]) {
          updates.push({
            id: item.id,
            external_id: newId
          });
          existingIds[newId] = true;
        }
        
        progressBar.increment();
      }
      
      // Apply updates
      if (updates.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < updates.length; i += batchSize) {
          const batch = updates.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(update =>
              dbLimit(() =>
                supabase
                  .from(table)
                  .update({ external_id: update.external_id })
                  .eq('id', update.id)
              )
            )
          );
        }
        
        totalUpdated += updates.length;
      }
    }
    
    progressBar.stop();
    console.log(`    ✅ Fixed ${totalUpdated} ${table}`);
  }
}

async function generateFinalReport() {
  console.log(chalk.yellow('\n📊 Generating final report...'));
  
  // Count standardized IDs
  const tables = ['teams', 'players', 'games'];
  const report: any = {};
  
  for (const table of tables) {
    // Count standardized
    const { count: standardized } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .like('external_id', 'espn_%_%');
    
    // Count numeric remaining
    const { count: numeric } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .filter('external_id', 'match', '^[0-9]+$');
    
    // Count non-standard
    const { count: total } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .not('external_id', 'is', null);
    
    report[table] = {
      total: total || 0,
      standardized: standardized || 0,
      numeric: numeric || 0,
      nonStandard: (total || 0) - (standardized || 0)
    };
  }
  
  console.log('\n' + chalk.bold.green('✅ ID STANDARDIZATION COMPLETE!'));
  console.log('\n' + chalk.bold('Summary:'));
  
  console.table(report);
  
  // Show samples of remaining issues if any
  for (const table of tables) {
    if (report[table].numeric > 0) {
      const { data: samples } = await supabase
        .from(table)
        .select('id, external_id' + (table !== 'games' ? ', name' : ''))
        .filter('external_id', 'match', '^[0-9]+$')
        .limit(5);
      
      if (samples && samples.length > 0) {
        console.log(`\n${chalk.yellow(`Sample numeric ${table}:`)} (may have conflicts)`);
        console.table(samples);
      }
    }
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 TURBO ID STANDARDIZATION'));
  console.log(chalk.yellow(`System: ${CPU_CORES} cores, ${RAM_GB}GB RAM\n`));
  
  const startTime = Date.now();
  
  try {
    await fixMisclassifiedTeams();
    
    // Run table standardizations in parallel where possible
    await Promise.all([
      standardizeTeamIds(),
      workerLimit(() => standardizePlayerIds()),
      workerLimit(() => standardizeGameIds())
    ]);
    
    await fixNcaaBaseballIds();
    
    multibar.stop();
    
    await generateFinalReport();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✨ Completed in ${duration}s`));
    
  } catch (error: any) {
    multibar.stop();
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (error.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

main();