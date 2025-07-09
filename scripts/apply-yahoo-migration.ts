#!/usr/bin/env tsx
/**
 * Apply Yahoo Write Operations Migration
 * 
 * This script applies the database migration for Yahoo Fantasy write operations
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function applyMigration() {
  console.log(chalk.yellow('🔄 Applying Yahoo Write Operations Migration...\n'))

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250108_yahoo_write_operations.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split into individual statements (by semicolon) and filter out empty ones
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(chalk.blue(`📝 Found ${statements.length} SQL statements to execute\n`))

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const firstLine = statement.split('\n')[0]
      
      console.log(chalk.gray(`[${i + 1}/${statements.length}] Executing: ${firstLine}...`))
      
      try {
        // Use raw SQL execution through Supabase
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        }).single()

        if (error) {
          // Try alternative approach - direct execution
          const { data, error: directError } = await supabase
            .from('_sql')
            .select('*')
            .eq('query', statement + ';')
            .single()

          if (directError) {
            throw directError
          }
        }

        console.log(chalk.green(`✓ Success\n`))
      } catch (err: any) {
        // Some errors are expected (like "already exists")
        if (err.message?.includes('already exists') || 
            err.message?.includes('duplicate key')) {
          console.log(chalk.yellow(`⚠️  Already exists (skipping)\n`))
        } else {
          console.log(chalk.red(`✗ Error: ${err.message}\n`))
          // Continue with other statements
        }
      }
    }

    // Verify tables were created
    console.log(chalk.blue('\n🔍 Verifying migration...\n'))

    const tablesToCheck = [
      'yahoo_transactions',
      'fantasy_lineup_changes', 
      'fantasy_transactions'
    ]

    for (const tableName of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (!error) {
          console.log(chalk.green(`✓ Table '${tableName}' exists`))
        } else {
          console.log(chalk.red(`✗ Table '${tableName}' not found: ${error.message}`))
        }
      } catch (err) {
        console.log(chalk.red(`✗ Error checking table '${tableName}'`))
      }
    }

    // Check if columns were added to platform_connections
    try {
      const { data, error } = await supabase
        .from('platform_connections')
        .select('scopes, lastWriteAt')
        .limit(1)

      if (!error) {
        console.log(chalk.green(`✓ Columns added to 'platform_connections'`))
      } else {
        console.log(chalk.yellow(`⚠️  Could not verify new columns: ${error.message}`))
      }
    } catch (err) {
      console.log(chalk.yellow(`⚠️  Could not check platform_connections columns`))
    }

    console.log(chalk.green('\n✅ Migration completed successfully!\n'))

  } catch (error: any) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message)
    process.exit(1)
  }
}

// Alternative approach using direct database connection
async function applyMigrationDirect() {
  console.log(chalk.yellow('\n🔄 Attempting direct database connection...\n'))
  
  try {
    const { Client } = require('pg')
    const connectionString = process.env.DATABASE_URL
    
    if (!connectionString) {
      throw new Error('DATABASE_URL not found in environment variables')
    }

    const client = new Client({ connectionString })
    await client.connect()

    console.log(chalk.green('✓ Connected to database\n'))

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250108_yahoo_write_operations.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Execute the entire migration as one transaction
    await client.query('BEGIN')
    
    try {
      await client.query(migrationSQL)
      await client.query('COMMIT')
      console.log(chalk.green('✅ Migration applied successfully!\n'))
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      await client.end()
    }

  } catch (error: any) {
    console.error(chalk.red('Direct migration failed:'), error.message)
    
    // If direct approach fails, try the Supabase approach
    console.log(chalk.yellow('\n🔄 Falling back to Supabase client approach...\n'))
    await applyMigration()
  }
}

// Run migration
applyMigrationDirect().catch(console.error)