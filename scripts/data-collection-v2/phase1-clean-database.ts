#!/usr/bin/env tsx
/**
 * 🧹 Phase 1: Database Cleanup Script
 * 
 * Cleans up old data while preserving player/team IDs
 * Removes pattern detection and unused tables
 */

import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

export class DatabaseCleanup {
  private skipConfirmation: boolean;
  
  constructor(skipConfirmation = false) {
    this.skipConfirmation = skipConfirmation;
  }
  
  private tablesToDrop = [
    // Game and stat tables (will recreate)
    'player_game_logs',
    'player_stats',
    'games',
    'game_logs',
    
    // Old pattern detection tables
    'patterns',
    'pattern_results',
    'pattern_validation',
    'correlation_results',
    
    // Revolutionary schema tables (unused)
    'quantum_correlations',
    'chaos_game_predictions',
    'biometric_analyses',
    'neural_nodes',
    'neural_connections',
    'swarm_predictions',
    'emergent_insights',
    
    // Old ML tables (will recreate better ones)
    'ml_training_data',
    'ml_predictions',
    'fantasy_projections',
    
    // Temporary/backup tables
    'player_game_logs_backup%',
    'players_backup%',
    'teams_backup%'
  ];
  
  private tablesToKeep = [
    'players',
    'teams'
  ];
  
  async run(): Promise<void> {
    console.log(chalk.red.bold('\n🧹 DATABASE CLEANUP - Phase 1\n'));
    console.log(chalk.yellow('⚠️  WARNING: This will delete game and stat data!'));
    console.log(chalk.green('✓ Player and team tables will be preserved\n'));
    
    // Show what will be deleted
    await this.showTablesStatus();
    
    // Confirm with user
    if (!this.skipConfirmation) {
      const answer = await question(chalk.red('\nAre you sure you want to proceed? (yes/no): '));
      if (answer.toLowerCase() !== 'yes') {
        console.log(chalk.yellow('Cleanup cancelled.'));
        process.exit(0);
      }
    }
    
    try {
      // 1. Drop old tables
      console.log(chalk.yellow('\n🗑️  Dropping old tables...'));
      await this.dropOldTables();
      
      // 2. Clean up player/team tables
      console.log(chalk.yellow('\n🧼 Cleaning player/team tables...'));
      await this.cleanPreservedTables();
      
      // 3. Vacuum database
      console.log(chalk.yellow('\n🔧 Optimizing database...'));
      await this.vacuumDatabase();
      
      // 4. Show final state
      console.log(chalk.yellow('\n📊 Final database state:'));
      await this.showFinalState();
      
      console.log(chalk.green.bold('\n✅ Database cleanup complete!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error);
      throw error;
    } finally {
      rl.close();
    }
  }
  
  private async showTablesStatus(): Promise<void> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = tablename) as columns
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    
    const result = await pgPool.query(query);
    
    console.log(chalk.cyan('Current tables:'));
    console.log(chalk.gray('─'.repeat(60)));
    
    for (const row of result.rows) {
      const willDelete = this.tablesToDrop.some(pattern => 
        row.tablename.match(new RegExp(pattern.replace('%', '.*')))
      );
      const willKeep = this.tablesToKeep.includes(row.tablename);
      
      const status = willDelete ? chalk.red('[DELETE]') : 
                    willKeep ? chalk.green('[KEEP]') : 
                    chalk.gray('[UNKNOWN]');
      
      console.log(
        `${status} ${row.tablename.padEnd(30)} ${row.size.padStart(10)} ${row.columns} cols`
      );
    }
    console.log(chalk.gray('─'.repeat(60)));
  }
  
  private async dropOldTables(): Promise<void> {
    let droppedCount = 0;
    
    for (const tablePattern of this.tablesToDrop) {
      try {
        if (tablePattern.includes('%')) {
          // Pattern match
          const tables = await pgPool.query(
            `SELECT tablename FROM pg_tables 
             WHERE schemaname = 'public' 
             AND tablename LIKE $1`,
            [tablePattern.replace('%', '%')]
          );
          
          for (const { tablename } of tables.rows) {
            await pgPool.query(`DROP TABLE IF EXISTS ${tablename} CASCADE`);
            console.log(chalk.red(`  ✗ Dropped ${tablename}`));
            droppedCount++;
          }
        } else {
          // Exact match
          await pgPool.query(`DROP TABLE IF EXISTS ${tablePattern} CASCADE`);
          console.log(chalk.red(`  ✗ Dropped ${tablePattern}`));
          droppedCount++;
        }
      } catch (error) {
        console.log(chalk.gray(`  - ${tablePattern} doesn't exist`));
      }
    }
    
    console.log(chalk.green(`\n✓ Dropped ${droppedCount} tables`));
  }
  
  private async cleanPreservedTables(): Promise<void> {
    // Remove any orphaned data
    console.log(chalk.yellow('  Cleaning orphaned player records...'));
    const orphanedPlayers = await pgPool.query(`
      DELETE FROM players 
      WHERE team_id IS NOT NULL 
      AND team_id NOT IN (SELECT id FROM teams)
      RETURNING id
    `);
    console.log(chalk.green(`  ✓ Removed ${orphanedPlayers.rowCount} orphaned players`));
    
    // Update metadata to ensure it's JSONB
    console.log(chalk.yellow('  Ensuring JSONB columns...'));
    
    // Check if the column exists first
    const playerColCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('external_id', 'external_ids')
    `);
    
    const teamColCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'teams' 
      AND column_name IN ('external_id', 'external_ids')
    `);
    
    // Only alter metadata for now
    await pgPool.query(`
      ALTER TABLE players 
      ALTER COLUMN metadata TYPE JSONB USING COALESCE(metadata, '{}')::JSONB
    `);
    
    await pgPool.query(`
      ALTER TABLE teams 
      ALTER COLUMN metadata TYPE JSONB USING COALESCE(metadata, '{}')::JSONB
    `);
    
    console.log(chalk.green('  ✓ Updated column types'));
  }
  
  private async vacuumDatabase(): Promise<void> {
    try {
      await pgPool.query('VACUUM ANALYZE');
      console.log(chalk.green('✓ Database vacuumed and analyzed'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not vacuum (requires superuser)'));
    }
  }
  
  private async showFinalState(): Promise<void> {
    const stats = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM players) as player_count,
        (SELECT COUNT(*) FROM teams) as team_count,
        (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
        pg_size_pretty(pg_database_size(current_database())) as db_size
    `);
    
    const row = stats.rows[0];
    console.log(chalk.cyan(`
  Players preserved: ${row.player_count}
  Teams preserved: ${row.team_count}
  Total tables: ${row.table_count}
  Database size: ${row.db_size}
    `));
  }
}

// Run if called directly
if (require.main === module) {
  const cleanup = new DatabaseCleanup();
  cleanup.run().catch(console.error);
}