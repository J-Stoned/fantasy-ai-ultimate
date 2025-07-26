/**
 * Export data from Supabase to local PostgreSQL
 * Elite implementation with proper SQL injection prevention
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Whitelist of allowed table names to prevent SQL injection
const ALLOWED_TABLES = [
  'achievements',
  'daily_challenges',
  'daily_fantasy_scores',
  'dfs_ownership',
  'game_logs',
  'injuries', 
  'leagues',
  'lineup_events',
  'player_news',
  'player_projections',
  'player_stats',
  'players',
  'rosters',
  'teams',
  'trades',
  'users',
  'waiver_wires'
];

interface ExportOptions {
  tables?: string[];
  outputFile?: string;
}

class DatabaseExporter {
  private sourcePool: Pool;
  private exportSQL: string = '';

  constructor() {
    // Source database (Supabase)
    this.sourcePool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  /**
   * Validate table name against whitelist
   */
  private validateTableName(tableName: string): boolean {
    return ALLOWED_TABLES.includes(tableName);
  }

  /**
   * Escape identifier for PostgreSQL
   */
  private escapeIdentifier(identifier: string): string {
    // PostgreSQL identifier escaping
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Export specific tables or all tables
   */
  async export(options: ExportOptions = {}): Promise<void> {
    const startTime = Date.now();
    console.log(chalk.blue('\n🚀 Starting Supabase Export\n'));

    try {
      // Get list of tables to export
      const tablesToExport = options.tables || ALLOWED_TABLES;
      
      // Validate all table names
      for (const table of tablesToExport) {
        if (!this.validateTableName(table)) {
          throw new Error(`Invalid table name: ${table}`);
        }
      }

      // Add header
      this.exportSQL = `-- Supabase Data Export
-- Generated: ${new Date().toISOString()}
-- Tables: ${tablesToExport.join(', ')}

BEGIN;

`;

      // Export each table
      for (const tableName of tablesToExport) {
        await this.exportTable(tableName);
      }

      // Add footer
      this.exportSQL += '\nCOMMIT;\n';

      // Write to file
      const outputFile = options.outputFile || `supabase-export-${Date.now()}.sql`;
      const outputPath = path.join(process.cwd(), outputFile);
      
      fs.writeFileSync(outputPath, this.exportSQL);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(chalk.green(`\n✅ Export completed in ${duration}s`));
      console.log(chalk.blue(`📁 Output file: ${outputPath}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Export failed:'), error);
      throw error;
    } finally {
      await this.sourcePool.end();
    }
  }

  /**
   * Export a single table with proper parameterization
   */
  private async exportTable(tableName: string): Promise<void> {
    console.log(chalk.yellow(`\nExporting table: ${tableName}`));
    
    try {
      // Get row count using parameterized query
      const countQuery = `SELECT COUNT(*) FROM ${this.escapeIdentifier(tableName)}`;
      const countResult = await this.sourcePool.query(countQuery);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount === 0) {
        console.log(chalk.gray(`  No data to export`));
        return;
      }

      console.log(chalk.gray(`  Exporting ${rowCount} rows...`));
      
      // Export data in batches
      const batchSize = 1000;
      let exported = 0;
      
      for (let offset = 0; offset < rowCount; offset += batchSize) {
        // Use proper query with LIMIT and OFFSET
        const dataQuery = `
          SELECT * FROM ${this.escapeIdentifier(tableName)}
          ORDER BY 1  -- Order by first column for consistent results
          LIMIT $1 OFFSET $2
        `;
        
        const rows = await this.sourcePool.query(dataQuery, [batchSize, offset]);
        
        if (rows.rows.length > 0) {
          const columns = Object.keys(rows.rows[0]);
          
          // Start of INSERT
          if (offset === 0) {
            this.exportSQL += `-- Data for ${tableName}\n`;
            this.exportSQL += `INSERT INTO ${this.escapeIdentifier(tableName)} (`;
            this.exportSQL += columns.map(c => this.escapeIdentifier(c)).join(', ');
            this.exportSQL += `) VALUES\n`;
          }
          
          // Add row data
          rows.rows.forEach((row, index) => {
            const isLastRow = offset + index === rowCount - 1;
            const values = columns.map(col => this.formatValue(row[col]));
            
            this.exportSQL += `(${values.join(', ')})`;
            this.exportSQL += isLastRow ? ';\n\n' : ',\n';
          });
          
          exported += rows.rows.length;
          
          // Progress update
          if (exported % 5000 === 0) {
            console.log(chalk.gray(`    Exported ${exported}/${rowCount} rows...`));
          }
        }
      }
      
      console.log(chalk.green(`  ✅ Exported ${exported} rows`));
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to export ${tableName}:`), error);
      throw error;
    }
  }

  /**
   * Format value for SQL with proper escaping
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string') {
      // Escape single quotes by doubling them
      return `'${value.replace(/'/g, "''")}'`;
    }
    
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    
    if (typeof value === 'object') {
      // JSON data - escape single quotes in JSON string
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    }
    
    // Numbers and other types
    return String(value);
  }
}

// Main execution
async function main() {
  const exporter = new DatabaseExporter();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: ExportOptions = {};
  
  // Check for specific tables
  const tableIndex = args.indexOf('--tables');
  if (tableIndex !== -1 && args[tableIndex + 1]) {
    options.tables = args[tableIndex + 1].split(',');
  }
  
  // Check for output file
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.outputFile = args[outputIndex + 1];
  }
  
  // Show help if requested
  if (args.includes('--help')) {
    console.log(`
Usage: tsx scripts/export-from-supabase.ts [options]

Options:
  --tables <table1,table2>  Comma-separated list of tables to export
  --output <filename>       Output SQL file name
  --help                    Show this help message

Examples:
  # Export all tables
  tsx scripts/export-from-supabase.ts
  
  # Export specific tables
  tsx scripts/export-from-supabase.ts --tables players,teams,game_logs
  
  # Export to specific file
  tsx scripts/export-from-supabase.ts --output backup.sql
`);
    process.exit(0);
  }
  
  await exporter.export(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export { DatabaseExporter };