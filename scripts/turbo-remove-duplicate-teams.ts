#!/usr/bin/env tsx
/**
 * 🚀 TURBO TEAM DEDUPLICATION
 * 
 * Removes 622 duplicate team groups
 * Merges all references to keeper team
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance settings
const CPU_CORES = os.cpus().length;
const dbLimit = pLimit(CPU_CORES);

interface TeamGroup {
  key: string;
  teams: any[];
  keeper: any;
  duplicates: any[];
}

async function removeDuplicateTeams() {
  console.log(chalk.bold.cyan('🚀 TURBO TEAM DEDUPLICATION\n'));
  console.log(chalk.yellow(`Using ${CPU_CORES} CPU cores\n`));

  const startTime = Date.now();

  try {
    // Step 1: Load all teams into RAM
    console.log(chalk.blue('1️⃣ Loading all teams into RAM...'));
    const allTeams = await loadAllTeams();
    console.log(chalk.green(`✅ Loaded ${allTeams.length} teams\n`));

    // Step 2: Find duplicate groups
    console.log(chalk.blue('2️⃣ Identifying duplicate groups...'));
    const duplicateGroups = findDuplicateGroups(allTeams);
    console.log(chalk.yellow(`Found ${duplicateGroups.length} duplicate groups\n`));

    if (duplicateGroups.length === 0) {
      console.log(chalk.green('✅ No duplicate teams found!'));
      return;
    }

    // Step 3: Process each duplicate group
    console.log(chalk.blue('3️⃣ Processing duplicate groups...'));
    
    const progress = new cliProgress.SingleBar({
      format: 'Progress |{bar}| {percentage}% | {value}/{total} | {duration_formatted}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progress.start(duplicateGroups.length, 0);

    let totalMerged = 0;
    let totalDeleted = 0;

    // Process groups in parallel batches
    const batchSize = 50;
    for (let i = 0; i < duplicateGroups.length; i += batchSize) {
      const batch = duplicateGroups.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(group => dbLimit(() => processDuplicateGroup(group)))
      );

      results.forEach(result => {
        totalMerged += result.merged;
        totalDeleted += result.deleted;
      });

      progress.update(i + batch.length);
    }

    progress.stop();

    // Generate report
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(chalk.bold.cyan('\n\n📊 DEDUPLICATION COMPLETE!\n'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.green(`✅ Processed ${duplicateGroups.length} duplicate groups`));
    console.log(chalk.green(`✅ Merged ${totalMerged.toLocaleString()} references`));
    console.log(chalk.green(`✅ Deleted ${totalDeleted} duplicate teams`));
    console.log(chalk.blue(`⏱️  Total time: ${duration.toFixed(1)} seconds`));
    console.log(chalk.blue(`🚀 Performance: ${Math.round(duplicateGroups.length / duration)} groups/second`));

    // Verify
    console.log(chalk.blue('\n🔍 Verifying deduplication...'));
    await verifyDeduplication();

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function loadAllTeams(): Promise<any[]> {
  const teams: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .range(offset, offset + 999);
    
    if (!data || data.length === 0) break;
    teams.push(...data);
    offset += 1000;
  }
  
  return teams;
}

function findDuplicateGroups(teams: any[]): TeamGroup[] {
  const groups = new Map<string, any[]>();
  
  // Group teams by name and sport
  teams.forEach(team => {
    const key = `${team.name}_${team.sport}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(team);
  });

  // Find groups with duplicates
  const duplicateGroups: TeamGroup[] = [];
  
  groups.forEach((teamList, key) => {
    if (teamList.length > 1) {
      // Sort by priority: has external_id, then by id
      teamList.sort((a, b) => {
        if (a.external_id && !b.external_id) return -1;
        if (!a.external_id && b.external_id) return 1;
        return a.id - b.id;
      });

      duplicateGroups.push({
        key,
        teams: teamList,
        keeper: teamList[0],
        duplicates: teamList.slice(1)
      });
    }
  });

  return duplicateGroups;
}

async function processDuplicateGroup(group: TeamGroup): Promise<{ merged: number; deleted: number }> {
  let merged = 0;
  
  try {
    // For each duplicate, update all references to point to keeper
    for (const duplicate of group.duplicates) {
      // Update players
      const { count: playerCount } = await supabase
        .from('players')
        .update({ team_id: group.keeper.id })
        .eq('team_id', duplicate.id);
      
      if (playerCount) merged += playerCount;

      // Update games (home team)
      const { count: homeCount } = await supabase
        .from('games')
        .update({ home_team_id: group.keeper.id })
        .eq('home_team_id', duplicate.id);
      
      if (homeCount) merged += homeCount;

      // Update games (away team)
      const { count: awayCount } = await supabase
        .from('games')
        .update({ away_team_id: group.keeper.id })
        .eq('away_team_id', duplicate.id);
      
      if (awayCount) merged += awayCount;

      // Update player_game_logs
      const { count: statsCount } = await supabase
        .from('player_game_logs')
        .update({ team_id: group.keeper.id })
        .eq('team_id', duplicate.id);
      
      if (statsCount) merged += statsCount;

      // Update team_synergy_stats
      const { count: synergyCount } = await supabase
        .from('team_synergy_stats')
        .update({ team_id: group.keeper.id })
        .eq('team_id', duplicate.id);
      
      if (synergyCount) merged += synergyCount;

      // Delete the duplicate team
      await supabase
        .from('teams')
        .delete()
        .eq('id', duplicate.id);
    }

    return { merged, deleted: group.duplicates.length };
    
  } catch (error) {
    console.error(chalk.red(`\nError processing group ${group.key}:`), error);
    return { merged: 0, deleted: 0 };
  }
}

async function verifyDeduplication() {
  // Count remaining duplicates
  const { data: teams } = await supabase
    .from('teams')
    .select('name, sport');

  if (!teams) return;

  const groups = new Map<string, number>();
  teams.forEach(team => {
    const key = `${team.name}_${team.sport}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  let duplicatesFound = 0;
  groups.forEach((count, key) => {
    if (count > 1) duplicatesFound++;
  });

  if (duplicatesFound === 0) {
    console.log(chalk.green('✅ No duplicate teams remaining!'));
  } else {
    console.log(chalk.yellow(`⚠️  Still found ${duplicatesFound} duplicate team groups`));
  }

  // Check for orphaned references
  const { count: orphanedPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'in', `(SELECT id FROM teams)`);

  if (orphanedPlayers && orphanedPlayers > 0) {
    console.log(chalk.yellow(`⚠️  Found ${orphanedPlayers} players with invalid team_id`));
  }
}

// Run the deduplication
removeDuplicateTeams().catch(console.error);