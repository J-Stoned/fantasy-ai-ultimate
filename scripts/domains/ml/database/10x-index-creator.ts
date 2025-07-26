#!/usr/bin/env tsx
/**
 * ⚡ 10X DATABASE INDEX CREATOR
 * 
 * Phase 4: Create indexes for LIGHTNING-FAST queries
 * Optimized for your Ryzen 5 7600X performance!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

interface IndexDefinition {
  name: string;
  table: string;
  columns: string;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
  partial?: string;
  description: string;
}

class TenXIndexCreator {
  private readonly indexes: IndexDefinition[] = [
    // Primary lookups
    {
      name: 'idx_pgl_player_date',
      table: 'player_game_logs',
      columns: '(player_id, game_date DESC)',
      description: 'Fast player game history lookups'
    },
    {
      name: 'idx_pgl_team_date',
      table: 'player_game_logs',
      columns: '(team_id, game_date DESC)',
      description: 'Fast team roster lookups by date'
    },
    
    // Fantasy scoring indexes
    {
      name: 'idx_pgl_fantasy_points',
      table: 'player_game_logs',
      columns: '(fantasy_points DESC) WHERE fantasy_points IS NOT NULL',
      description: 'Fast fantasy point sorting',
      partial: 'fantasy_points IS NOT NULL'
    },
    // Sport is on players table, not player_game_logs
    // Skip this one
    
    // Date-based queries
    {
      name: 'idx_pgl_game_date',
      table: 'player_game_logs',
      columns: '(game_date DESC)',
      description: 'Fast date-based queries'
    },
    {
      name: 'idx_pgl_season',
      table: 'player_game_logs',
      columns: '(EXTRACT(YEAR FROM game_date), sport)',
      description: 'Season-based queries'
    },
    
    // Stats queries (using GIN for JSONB)
    {
      name: 'idx_pgl_stats_gin',
      table: 'player_game_logs',
      columns: '(stats)',
      type: 'gin',
      description: 'Fast JSONB stats searches'
    },
    
    // Player indexes
    {
      name: 'idx_players_sport_pos',
      table: 'players',
      columns: '(sport, position)',
      description: 'Fast position filtering by sport'
    },
    {
      name: 'idx_players_name',
      table: 'players',
      columns: '(LOWER(name))',
      description: 'Fast case-insensitive name search'
    },
    
    // Team indexes
    {
      name: 'idx_teams_sport',
      table: 'teams',
      columns: '(sport)',
      description: 'Fast team lookups by sport'
    },
    {
      name: 'idx_teams_location',
      table: 'teams',
      columns: '(location, sport)',
      description: 'Location-based team lookups'
    },
    
    // Composite indexes for complex queries
    {
      name: 'idx_pgl_player_team_date',
      table: 'player_game_logs',
      columns: '(player_id, team_id, game_date DESC)',
      description: 'Player trades and team history'
    },
    {
      name: 'idx_pgl_sport_date_fp',
      table: 'player_game_logs',
      columns: '(sport, game_date DESC, fantasy_points DESC)',
      description: 'Daily fantasy leaderboards by sport'
    },
    
    // ML training indexes
    {
      name: 'idx_pgl_ml_training',
      table: 'player_game_logs',
      columns: '(player_id, game_date)',
      partial: 'stats IS NOT NULL AND fantasy_points IS NOT NULL',
      description: 'ML training data optimization'
    }
  ];

  async execute() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║            ⚡ 10X DATABASE INDEX CREATOR ⚡                   ║
    ║                                                              ║
    ║  Creating indexes for LIGHTNING-FAST queries!                ║
    ║  Optimized for Ryzen 5 7600X performance 🚀                  ║
    ╚══════════════════════════════════════════════════════════════╝
    `));

    const startTime = Date.now();

    try {
      // Step 1: Analyze current indexes
      console.log(chalk.cyan.bold('\n📊 STEP 1: ANALYZING EXISTING INDEXES...\n'));
      const existingIndexes = await this.getExistingIndexes();
      
      // Step 2: Create missing indexes
      console.log(chalk.cyan.bold('\n🔨 STEP 2: CREATING OPTIMIZED INDEXES...\n'));
      await this.createIndexes(existingIndexes);
      
      // Step 3: Analyze tables for query optimization
      console.log(chalk.cyan.bold('\n📈 STEP 3: ANALYZING TABLES FOR OPTIMIZATION...\n'));
      await this.analyzeTables();
      
      // Step 4: Show index usage stats
      console.log(chalk.cyan.bold('\n📊 STEP 4: INDEX USAGE STATISTICS...\n'));
      await this.showIndexStats();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║              ✅ INDEX CREATION COMPLETE!                     ║
    ║                                                              ║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║  Your queries are now LIGHTNING FAST! ⚡                     ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  private async getExistingIndexes(): Promise<Set<string>> {
    console.log(chalk.yellow('Checking existing indexes...'));
    
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    
    const result = await pgPool.query(query);
    const existingIndexes = new Set<string>();
    
    console.log(chalk.cyan(`Found ${result.rows.length} existing indexes`));
    
    result.rows.forEach(row => {
      existingIndexes.add(row.indexname);
    });
    
    return existingIndexes;
  }

  private async createIndexes(existingIndexes: Set<string>) {
    console.log(chalk.yellow(`Creating ${this.indexes.length} optimized indexes...`));
    
    let created = 0;
    let skipped = 0;
    
    for (const index of this.indexes) {
      if (existingIndexes.has(index.name)) {
        console.log(chalk.gray(`⏭️  Skipping ${index.name} (already exists)`));
        skipped++;
        continue;
      }
      
      console.log(chalk.cyan(`\n🔨 Creating ${index.name}...`));
      console.log(chalk.gray(`   ${index.description}`));
      
      const indexType = index.type?.toUpperCase() || 'BTREE';
      const whereClause = index.partial ? `WHERE ${index.partial}` : '';
      
      const createQuery = `
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name}
        ON ${index.table} USING ${indexType} ${index.columns}
        ${whereClause}
      `;
      
      try {
        const startTime = Date.now();
        await pgPool.query(createQuery);
        const duration = (Date.now() - startTime) / 1000;
        
        console.log(chalk.green(`   ✅ Created in ${duration.toFixed(1)}s`));
        created++;
      } catch (error: any) {
        if (error.code === '42P07') { // duplicate_table error
          console.log(chalk.yellow(`   ⏭️  Already exists`));
          skipped++;
        } else {
          console.log(chalk.red(`   ❌ Failed: ${error.message}`));
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Created ${created} new indexes, skipped ${skipped} existing`));
  }

  private async analyzeTables() {
    console.log(chalk.yellow('Analyzing tables for query optimization...'));
    
    const tables = ['player_game_logs', 'players', 'teams'];
    
    for (const table of tables) {
      console.log(chalk.cyan(`\nAnalyzing ${table}...`));
      
      try {
        await pgPool.query(`ANALYZE ${table}`);
        
        // Get table stats
        const statsQuery = `
          SELECT 
            n_live_tup as row_count,
            n_dead_tup as dead_rows,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
          FROM pg_stat_user_tables
          WHERE tablename = $1
        `;
        
        const stats = await pgPool.query(statsQuery, [table]);
        if (stats.rows.length > 0) {
          const s = stats.rows[0];
          console.log(chalk.gray(`  Rows: ${parseInt(s.row_count).toLocaleString()}`));
          console.log(chalk.gray(`  Dead rows: ${parseInt(s.dead_rows).toLocaleString()}`));
          console.log(chalk.gray(`  Last analyzed: ${s.last_analyze || s.last_autoanalyze || 'Never'}`));
        }
        
        console.log(chalk.green(`  ✅ Analysis complete`));
      } catch (error) {
        console.log(chalk.red(`  ❌ Failed to analyze`));
      }
    }
  }

  private async showIndexStats() {
    console.log(chalk.yellow('Index usage statistics...'));
    
    // Get index sizes
    const sizeQuery = `
      SELECT 
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 15
    `;
    
    const result = await pgPool.query(sizeQuery);
    
    console.log(chalk.cyan('\nTop indexes by size:'));
    console.log(chalk.gray('Index Name                                    Size      Scans'));
    console.log(chalk.gray('────────────────────────────────────────────────────────────'));
    
    result.rows.forEach(row => {
      const scans = row.index_scans || '0';
      console.log(
        `${row.indexname.padEnd(45)} ${row.index_size.padStart(8)} ${scans.toString().padStart(10)}`
      );
    });
    
    // Get total index size
    const totalSizeQuery = `
      SELECT 
        pg_size_pretty(sum(pg_relation_size(indexrelid))) as total_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
    `;
    
    const totalSize = await pgPool.query(totalSizeQuery);
    console.log(chalk.yellow(`\nTotal index size: ${totalSize.rows[0].total_size}`));
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      const indexCreator = new TenXIndexCreator();
      await indexCreator.execute();
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXIndexCreator };