#!/usr/bin/env tsx
/**
 * 🏗️ Phase 1: Create Standardized Schema
 * 
 * Creates the new master tables with cross-platform ID support
 * Includes tables for teams, games, players, stats, and betting data
 */

import { pgPool } from '../fantasy-ml/config/database';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

export class SchemaCreator {
  private schemaFile = path.join(__dirname, 'phase1-create-schema.sql');
  
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🏗️  CREATE STANDARDIZED SCHEMA - Phase 1\n'));
    
    try {
      // 1. Read schema SQL
      console.log(chalk.yellow('📄 Reading schema file...'));
      const schemaSql = await fs.readFile(this.schemaFile, 'utf-8');
      
      // 2. Split into individual statements
      const statements = this.splitSqlStatements(schemaSql);
      console.log(chalk.green(`✓ Found ${statements.length} SQL statements`));
      
      // 3. Execute each statement
      console.log(chalk.yellow('\n🔨 Creating schema...'));
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        
        try {
          // Extract table/object name for logging
          const objectName = this.extractObjectName(trimmed);
          process.stdout.write(`  Creating ${objectName}... `);
          
          await pgPool.query(trimmed);
          console.log(chalk.green('✓'));
          successCount++;
        } catch (error: any) {
          console.log(chalk.red('✗'));
          console.log(chalk.red(`    Error: ${error.message}`));
          errorCount++;
        }
      }
      
      // 4. Verify creation
      console.log(chalk.yellow('\n🔍 Verifying schema...'));
      await this.verifySchema();
      
      // 5. Show summary
      console.log(chalk.cyan('\n📊 Summary:'));
      console.log(chalk.green(`  ✓ Successful: ${successCount}`));
      if (errorCount > 0) {
        console.log(chalk.red(`  ✗ Failed: ${errorCount}`));
      }
      
      console.log(chalk.green.bold('\n✅ Schema creation complete!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Schema creation failed:'), error);
      throw error;
    }
  }
  
  private splitSqlStatements(sql: string): string[] {
    // Remove comments first
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split by semicolon more carefully
    const statements: string[] = [];
    let current = '';
    let inFunction = false;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];
      const prevChar = i > 0 ? cleanedSql[i - 1] : '';
      
      // Handle string literals
      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      // Check for function markers
      if (!inString) {
        const upcomingText = cleanedSql.slice(i, i + 50).toUpperCase();
        if (upcomingText.includes('CREATE FUNCTION') || upcomingText.includes('CREATE OR REPLACE FUNCTION')) {
          inFunction = true;
        }
        if (inFunction && upcomingText.includes('$$ LANGUAGE')) {
          inFunction = false;
        }
      }
      
      current += char;
      
      // If we hit a semicolon outside strings and functions
      if (char === ';' && !inString && !inFunction) {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
      }
    }
    
    // Add any remaining statement
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    return statements;
  }
  
  private extractObjectName(sql: string): string {
    const patterns = [
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
      /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i,
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/i,
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)/i,
      /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)/i,
      /CREATE\s+TRIGGER\s+(\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = sql.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // Default to first few words
    return sql.split(/\s+/).slice(0, 3).join(' ');
  }
  
  private async verifySchema(): Promise<void> {
    // Check tables
    const tableResult = await pgPool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (
        'teams_master',
        'games_master', 
        'players_master',
        'player_game_stats',
        'betting_lines',
        'player_props'
      )
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('\n  Tables created:'));
    for (const row of tableResult.rows) {
      console.log(chalk.green(`    ✓ ${row.tablename}`));
    }
    
    // Check indexes
    const indexResult = await pgPool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN (
        'teams_master',
        'games_master', 
        'players_master',
        'player_game_stats',
        'betting_lines',
        'player_props'
      )
      AND indexname NOT LIKE '%_pkey'
      ORDER BY indexname
    `);
    
    console.log(chalk.cyan(`\n  Indexes created: ${indexResult.rowCount}`));
    
    // Check views
    const viewResult = await pgPool.query(`
      SELECT viewname 
      FROM pg_views 
      WHERE schemaname = 'public'
      ORDER BY viewname
    `);
    
    if (viewResult.rowCount > 0) {
      console.log(chalk.cyan('\n  Views created:'));
      for (const row of viewResult.rows) {
        console.log(chalk.green(`    ✓ ${row.viewname}`));
      }
    }
    
    // Show column counts for main tables
    console.log(chalk.cyan('\n  Table structures:'));
    const mainTables = ['teams_master', 'games_master', 'players_master', 'player_game_stats'];
    
    for (const table of mainTables) {
      const colResult = await pgPool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = $1
        AND table_schema = 'public'
      `, [table]);
      
      console.log(`    ${table}: ${colResult.rows[0].count} columns`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const creator = new SchemaCreator();
  creator.run().catch(console.error);
}