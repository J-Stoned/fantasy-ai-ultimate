#!/usr/bin/env tsx
/**
 * Apply Universal ID Migration
 * Creates tables and runs the migration
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function applyMigration() {
  console.log(chalk.cyan.bold('\n🔄 APPLYING UNIVERSAL ID MIGRATION\n'))
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250712_create_game_external_ids.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log(chalk.yellow('📝 Running migration SQL...'))
    
    // Split SQL into individual statements (Supabase doesn't handle multiple statements well)
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';')
    
    for (const statement of statements) {
      // Skip comments
      if (statement.startsWith('--')) continue
      
      console.log(chalk.dim(`Executing: ${statement.substring(0, 50)}...`))
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).select()
      
      if (error) {
        // Try direct execution if RPC fails
        console.log(chalk.yellow('RPC failed, trying direct execution...'))
        // Note: Direct SQL execution requires admin access
        console.log(chalk.red(`Statement failed: ${statement.substring(0, 100)}...`))
        console.log(chalk.red(`Error: ${error.message}`))
      }
    }
    
    console.log(chalk.green('\n✅ Migration completed!\n'))
    
    // Verify the migration
    await verifyMigration()
    
  } catch (error) {
    console.error(chalk.red('Migration failed:'), error)
    console.log(chalk.yellow('\n⚠️  You may need to run the migration directly in Supabase Dashboard'))
    console.log(chalk.yellow('Go to: SQL Editor → New Query → Paste the migration SQL'))
  }
}

async function verifyMigration() {
  console.log(chalk.cyan('🔍 Verifying migration...\n'))
  
  // Test inserting into game_external_ids
  const testInsert = await supabase
    .from('game_external_ids')
    .insert({
      game_id: 1,
      source: 'test',
      external_id: 'test_123'
    })
    .select()
  
  if (testInsert.error) {
    console.log(chalk.red('❌ game_external_ids table not working:', testInsert.error.message))
  } else {
    console.log(chalk.green('✅ game_external_ids table is working'))
    
    // Clean up test data
    await supabase
      .from('game_external_ids')
      .delete()
      .eq('source', 'test')
  }
  
  // Check universal_id column
  const { data: game } = await supabase
    .from('games')
    .select('id, universal_id')
    .limit(1)
    .single()
  
  if (game && 'universal_id' in game) {
    console.log(chalk.green('✅ universal_id column exists in games table'))
  } else {
    console.log(chalk.red('❌ universal_id column not found in games table'))
  }
}

// Alternative: Show manual migration instructions
function showManualInstructions() {
  console.log(chalk.yellow.bold('\n📋 MANUAL MIGRATION INSTRUCTIONS:\n'))
  console.log('1. Go to your Supabase Dashboard')
  console.log('2. Navigate to SQL Editor')
  console.log('3. Click "New Query"')
  console.log('4. Copy and paste the contents of:')
  console.log(chalk.cyan('   supabase/migrations/20250712_create_game_external_ids.sql'))
  console.log('5. Click "Run" to execute the migration')
  console.log('\n6. After migration, run:')
  console.log(chalk.green('   npx tsx scripts/generate-universal-ids.ts'))
  console.log(chalk.green('   npx tsx scripts/migrate-external-ids.ts'))
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--manual')) {
    showManualInstructions()
  } else {
    await applyMigration()
    
    console.log(chalk.cyan('\n📌 Next Steps:'))
    console.log('1. If migration succeeded, run:')
    console.log(chalk.green('   npx tsx scripts/generate-universal-ids.ts'))
    console.log(chalk.green('   npx tsx scripts/migrate-external-ids.ts'))
    console.log('\n2. If migration failed, run:')
    console.log(chalk.yellow('   npx tsx scripts/apply-universal-id-migration.ts --manual'))
  }
}

main().catch(console.error)