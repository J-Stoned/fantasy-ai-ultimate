#!/usr/bin/env tsx
/**
 * ⚡ FAST RESTORE - Parallel data restoration
 */

import { pgPool } from '../fantasy-ml/config/database';
import { ParallelCollectionEngine } from './phase2-parallel-engine';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

async function fastRestore() {
  const startTime = Date.now();
  console.log(chalk.cyan.bold('\n⚡ FAST DATA RESTORE\n'));
  
  try {
    const engine = new ParallelCollectionEngine();
    
    // Load backup
    const backupPath = path.join(__dirname, '../../backups/pre-v2-collection/backup-2025-07-22.json');
    console.log(chalk.yellow('📦 Loading backup...'));
    const backup = JSON.parse(await fs.readFile(backupPath, 'utf-8'));
    
    console.log(chalk.cyan(`  Teams: ${backup.tables.teams.length.toLocaleString()}`));
    console.log(chalk.cyan(`  Players: ${backup.tables.players.length.toLocaleString()}\n`));
    
    // Map old data to new schema
    console.log(chalk.yellow('🔄 Mapping to new schema...'));
    
    // Teams
    const teams = backup.tables.teams.map(team => ({
      our_team_id: team.id,
      sport: team.sport || 'UNKNOWN',
      name: team.name || 'Unknown Team',
      city: team.city,
      abbreviation: team.abbreviation,
      espn_id: team.external_id?.split('_').pop(),
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    // Players  
    const players = backup.tables.players.map(player => ({
      our_player_id: player.id,
      sport: player.sport || 'UNKNOWN',
      name: player.name || 'Unknown Player',
      position: player.position,
      espn_id: player.external_id?.split('_').pop(),
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    // Insert in parallel
    await Promise.all([
      engine.bulkInsert('teams_master', teams, {
        conflictTarget: 'our_team_id',
        updateColumns: ['updated_at']
      }),
      
      engine.bulkInsert('players_master', players, {
        conflictTarget: 'our_player_id',
        updateColumns: ['updated_at']
      })
    ]);
    
    const duration = Date.now() - startTime;
    console.log(chalk.green.bold(`\n✅ RESTORE COMPLETE in ${(duration/1000).toFixed(1)}s!\n`));
    
    await engine.showSummary();
    
  } catch (error) {
    console.error(chalk.red('❌ Restore failed:'), error);
  } finally {
    await pgPool.end();
  }
}

fastRestore().catch(console.error);