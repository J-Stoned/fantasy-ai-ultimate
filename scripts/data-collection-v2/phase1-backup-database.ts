#!/usr/bin/env tsx
/**
 * 🔄 Phase 1: Database Backup Script
 * 
 * Backs up current player and team IDs before cleanup
 * Preserves our established ID mappings
 */

import { pgPool } from '../fantasy-ml/config/database';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

interface BackupData {
  timestamp: string;
  version: string;
  tables: {
    players: any[];
    teams: any[];
    playerIdMappings: any[];
    teamIdMappings: any[];
  };
  counts: {
    players: number;
    teams: number;
    games: number;
    stats: number;
  };
}

export class DatabaseBackup {
  private backupDir = path.join(__dirname, '../../backups/pre-v2-collection');
  
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔄 DATABASE BACKUP - Phase 1\n'));
    
    try {
      // Create backup directory
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // 1. Get current counts
      console.log(chalk.yellow('📊 Checking current database state...'));
      const counts = await this.getDatabaseCounts();
      this.displayCounts(counts);
      
      // 2. Backup player data with ID mappings
      console.log(chalk.yellow('\n💾 Backing up player data...'));
      const players = await this.backupPlayers();
      console.log(chalk.green(`✓ Backed up ${players.length} players`));
      
      // 3. Backup team data with ID mappings
      console.log(chalk.yellow('\n💾 Backing up team data...'));
      const teams = await this.backupTeams();
      console.log(chalk.green(`✓ Backed up ${teams.length} teams`));
      
      // 4. Backup ID mappings
      console.log(chalk.yellow('\n🔗 Backing up ID mappings...'));
      const { playerMappings, teamMappings } = await this.backupIdMappings();
      console.log(chalk.green(`✓ Backed up ${playerMappings.length} player mappings`));
      console.log(chalk.green(`✓ Backed up ${teamMappings.length} team mappings`));
      
      // 5. Create backup file
      const backup: BackupData = {
        timestamp: new Date().toISOString(),
        version: '2.0-pre-collection',
        tables: {
          players,
          teams,
          playerIdMappings: playerMappings,
          teamIdMappings: teamMappings
        },
        counts
      };
      
      const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.backupDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(backup, null, 2));
      console.log(chalk.green.bold(`\n✅ Backup saved to: ${filepath}`));
      
      // 6. Create SQL restore script
      await this.createRestoreScript(backup);
      
    } catch (error) {
      console.error(chalk.red('❌ Backup failed:'), error);
      throw error;
    }
  }
  
  private async getDatabaseCounts(): Promise<BackupData['counts']> {
    const queries = [
      { name: 'players', query: 'SELECT COUNT(*) FROM players' },
      { name: 'teams', query: 'SELECT COUNT(*) FROM teams' },
      { name: 'games', query: 'SELECT COUNT(*) FROM games' },
      { name: 'stats', query: 'SELECT COUNT(*) FROM player_game_logs' }
    ];
    
    const counts: any = {};
    
    for (const { name, query } of queries) {
      try {
        const result = await pgPool.query(query);
        counts[name] = parseInt(result.rows[0].count);
      } catch (error) {
        counts[name] = 0;
      }
    }
    
    return counts;
  }
  
  private displayCounts(counts: BackupData['counts']): void {
    console.log(chalk.cyan('\n📈 Current Database:'));
    console.log(`  Players: ${counts.players.toLocaleString()}`);
    console.log(`  Teams: ${counts.teams.toLocaleString()}`);
    console.log(`  Games: ${counts.games.toLocaleString()}`);
    console.log(`  Stats: ${counts.stats.toLocaleString()}`);
  }
  
  private async backupPlayers(): Promise<any[]> {
    const query = `
      SELECT 
        id,
        name,
        sport,
        position,
        team_id,
        metadata,
        external_id
      FROM players
      WHERE id IS NOT NULL
      ORDER BY sport, name
    `;
    
    const result = await pgPool.query(query);
    return result.rows;
  }
  
  private async backupTeams(): Promise<any[]> {
    const query = `
      SELECT 
        id,
        name,
        abbreviation,
        sport,
        city,
        metadata,
        external_id
      FROM teams
      WHERE id IS NOT NULL
      ORDER BY sport, name
    `;
    
    const result = await pgPool.query(query);
    return result.rows;
  }
  
  private async backupIdMappings(): Promise<{ playerMappings: any[], teamMappings: any[] }> {
    // Extract all external ID mappings from external_id column
    const playerMappings: any[] = [];
    const teamMappings: any[] = [];
    
    // Get player mappings
    const playerQuery = `
      SELECT 
        id as our_id,
        external_id,
        name,
        sport
      FROM players
      WHERE external_id IS NOT NULL
    `;
    
    const playerResult = await pgPool.query(playerQuery);
    for (const row of playerResult.rows) {
      if (row.external_id) {
        // External ID format is usually "espn_sport_id"
        const parts = row.external_id.split('_');
        if (parts.length >= 3) {
          playerMappings.push({
            our_id: row.our_id,
            platform: parts[0],
            external_id: row.external_id,
            name: row.name,
            sport: row.sport
          });
        }
      }
    }
    
    // Get team mappings
    const teamQuery = `
      SELECT 
        id as our_id,
        external_id,
        name,
        sport
      FROM teams
      WHERE external_id IS NOT NULL
    `;
    
    const teamResult = await pgPool.query(teamQuery);
    for (const row of teamResult.rows) {
      if (row.external_id) {
        // External ID format is usually "espn_sport_id"
        const parts = row.external_id.split('_');
        if (parts.length >= 3) {
          teamMappings.push({
            our_id: row.our_id,
            platform: parts[0],
            external_id: row.external_id,
            name: row.name,
            sport: row.sport
          });
        }
      }
    }
    
    return { playerMappings, teamMappings };
  }
  
  private async createRestoreScript(backup: BackupData): Promise<void> {
    const script = `-- Restore script for database backup ${backup.timestamp}
-- This script will restore player and team data with ID mappings

-- 1. Restore teams
${backup.tables.teams.map(team => `
INSERT INTO teams (id, name, abbreviation, sport, city, metadata, external_id)
VALUES (
  '${team.id}',
  ${team.name ? `'${team.name.replace(/'/g, "''")}'` : 'NULL'},
  '${team.abbreviation || ''}',
  '${team.sport}',
  '${team.city || ''}',
  '${JSON.stringify(team.metadata || {}).replace(/'/g, "''")}',
  '${team.external_id || ''}'
) ON CONFLICT (id) DO UPDATE SET
  external_id = EXCLUDED.external_id;
`).join('')}

-- 2. Restore players
${backup.tables.players.map(player => `
INSERT INTO players (id, name, sport, position, team_id, metadata, external_id)
VALUES (
  '${player.id}',
  ${player.name ? `'${player.name.replace(/'/g, "''")}'` : 'NULL'},
  '${player.sport}',
  '${player.position || ''}',
  ${player.team_id ? `'${player.team_id}'` : 'NULL'},
  '${JSON.stringify(player.metadata || {}).replace(/'/g, "''")}',
  '${player.external_id || ''}'
) ON CONFLICT (id) DO UPDATE SET
  external_id = EXCLUDED.external_id;
`).join('')}

-- 3. Summary
-- Teams restored: ${backup.tables.teams.length}
-- Players restored: ${backup.tables.players.length}
-- Player ID mappings: ${backup.tables.playerIdMappings.length}
-- Team ID mappings: ${backup.tables.teamIdMappings.length}
`;
    
    const filename = `restore-${new Date().toISOString().split('T')[0]}.sql`;
    const filepath = path.join(this.backupDir, filename);
    await fs.writeFile(filepath, script);
    console.log(chalk.green(`✓ Restore script saved to: ${filepath}`));
  }
}

// Run if called directly
if (require.main === module) {
  const backup = new DatabaseBackup();
  backup.run().catch(console.error);
}