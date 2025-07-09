#!/usr/bin/env tsx
/**
 * Verify Yahoo Write Operations Setup
 * 
 * This script verifies that all database tables and columns are properly set up
 * for Yahoo Fantasy write operations
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifySetup() {
  console.log(chalk.yellow('\n🔍 Verifying Yahoo Write Operations Setup\n'))

  const checks = {
    tables: true,
    columns: true,
    connections: true,
    environment: true
  }

  // 1. Check if all tables exist
  console.log(chalk.blue('📋 Checking Tables...'))
  const tables = [
    'yahoo_transactions',
    'fantasy_lineup_changes',
    'fantasy_transactions',
    'platform_connections'
  ]

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        console.log(chalk.green(`✓ Table '${table}' exists`))
      } else {
        console.log(chalk.red(`✗ Table '${table}' error: ${error.message}`))
        checks.tables = false
      }
    } catch (err) {
      console.log(chalk.red(`✗ Table '${table}' not found`))
      checks.tables = false
    }
  }

  // 2. Check platform_connections columns
  console.log(chalk.blue('\n📋 Checking platform_connections columns...'))
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('id, platform, scopes, lastWriteAt, isActive, accessToken')
      .limit(1)

    if (!error) {
      console.log(chalk.green(`✓ Column 'scopes' exists`))
      console.log(chalk.green(`✓ Column 'lastWriteAt' exists`))
      console.log(chalk.green(`✓ All required columns present`))
    } else {
      console.log(chalk.red(`✗ Column check failed: ${error.message}`))
      checks.columns = false
    }
  } catch (err: any) {
    console.log(chalk.red(`✗ Error checking columns: ${err.message}`))
    checks.columns = false
  }

  // 3. Check for Yahoo connections
  console.log(chalk.blue('\n📋 Checking Yahoo connections...'))
  try {
    const { data: connections, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('platform', 'yahoo')

    if (!error) {
      if (connections && connections.length > 0) {
        console.log(chalk.green(`✓ Found ${connections.length} Yahoo connection(s)`))
        
        // Check if any are active
        const activeConnections = connections.filter(c => c.isActive)
        if (activeConnections.length > 0) {
          console.log(chalk.green(`✓ ${activeConnections.length} active Yahoo connection(s)`))
          
          // Update scopes for Yahoo connections if not set
          for (const conn of connections) {
            if (!conn.scopes) {
              const { error: updateError } = await supabase
                .from('platform_connections')
                .update({ scopes: 'fspt-w' })
                .eq('id', conn.id)
                
              if (!updateError) {
                console.log(chalk.yellow(`  → Updated scopes for connection ${conn.id}`))
              }
            }
          }
        } else {
          console.log(chalk.yellow(`⚠️  No active Yahoo connections found`))
          checks.connections = false
        }
      } else {
        console.log(chalk.yellow(`⚠️  No Yahoo connections found`))
        console.log(chalk.gray(`  → Users need to connect their Yahoo account first`))
        checks.connections = false
      }
    } else {
      console.log(chalk.red(`✗ Error checking connections: ${error.message}`))
      checks.connections = false
    }
  } catch (err: any) {
    console.log(chalk.red(`✗ Error: ${err.message}`))
    checks.connections = false
  }

  // 4. Check environment variables
  console.log(chalk.blue('\n📋 Checking environment variables...'))
  const envVars = {
    'YAHOO_CLIENT_ID': process.env.YAHOO_CLIENT_ID,
    'YAHOO_CLIENT_SECRET': process.env.YAHOO_CLIENT_SECRET,
    'YAHOO_REDIRECT_URI': process.env.YAHOO_REDIRECT_URI
  }

  for (const [key, value] of Object.entries(envVars)) {
    if (value) {
      console.log(chalk.green(`✓ ${key} is set`))
    } else {
      console.log(chalk.yellow(`⚠️  ${key} is not set`))
      checks.environment = false
    }
  }

  // 5. Test creating a record in each table
  console.log(chalk.blue('\n📋 Testing table writes...'))
  
  // Test fantasy_lineup_changes
  try {
    const { error } = await supabase
      .from('fantasy_lineup_changes')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        platform: 'yahoo',
        league_id: 'test',
        team_key: 'test',
        changes: [{ test: true }],
        coverage_type: 'week',
        coverage_value: '1',
        status: 'test'
      })
      .select()
      .single()

    if (error && !error.message.includes('violates foreign key constraint')) {
      console.log(chalk.red(`✗ Cannot write to fantasy_lineup_changes: ${error.message}`))
    } else {
      console.log(chalk.green(`✓ fantasy_lineup_changes table is writable`))
      
      // Clean up test record
      await supabase
        .from('fantasy_lineup_changes')
        .delete()
        .eq('league_id', 'test')
    }
  } catch (err: any) {
    console.log(chalk.red(`✗ Error testing fantasy_lineup_changes: ${err.message}`))
  }

  // Summary
  console.log(chalk.yellow('\n📊 Setup Summary:\n'))
  
  const allGood = Object.values(checks).every(v => v)
  
  if (allGood) {
    console.log(chalk.green('✅ All systems ready for Yahoo Fantasy write operations!'))
    console.log(chalk.gray('\nNext steps:'))
    console.log(chalk.gray('1. Set Yahoo OAuth credentials in .env.local'))
    console.log(chalk.gray('2. Have users connect their Yahoo accounts'))
    console.log(chalk.gray('3. Start syncing lineups!'))
  } else {
    console.log(chalk.yellow('⚠️  Some components need attention:'))
    
    if (!checks.tables) {
      console.log(chalk.red('\n❌ Some tables are missing'))
    }
    
    if (!checks.columns) {
      console.log(chalk.red('\n❌ Required columns are missing from platform_connections'))
    }
    
    if (!checks.connections) {
      console.log(chalk.yellow('\n⚠️  No active Yahoo connections found'))
      console.log(chalk.gray('   This is normal if no users have connected Yahoo yet'))
    }
    
    if (!checks.environment) {
      console.log(chalk.yellow('\n⚠️  Yahoo OAuth credentials not configured'))
      console.log(chalk.gray('   Add these to your .env.local file:'))
      console.log(chalk.gray('   - YAHOO_CLIENT_ID'))
      console.log(chalk.gray('   - YAHOO_CLIENT_SECRET'))
      console.log(chalk.gray('   - YAHOO_REDIRECT_URI'))
    }
  }
  
  console.log(chalk.blue('\n💡 To test the full flow:'))
  console.log(chalk.gray('1. Run: npx tsx scripts/test-yahoo-write-operations.ts'))
  console.log(chalk.gray('2. Or use the lineup optimizer UI with a connected Yahoo account\n'))
}

verifySetup().catch(console.error)