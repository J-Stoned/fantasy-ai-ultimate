#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkDependencies() {
  console.log('🔍 Checking game dependencies...')
  
  // Get a sample fake game
  const { data: sampleGame, error } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
    .limit(1)
    .single()
  
  if (error || !sampleGame) {
    console.error('Error fetching sample game:', error)
    return
  }
  
  console.log(`\n📋 Checking dependencies for game ID: ${sampleGame.id}`)
  
  // Check all potential tables that might reference games
  const tablesToCheck = [
    'player_stats',
    'player_game_logs',
    'ml_predictions',
    'game_predictions',
    'player_performances',
    'team_performances',
    'weather_data',
    'betting_odds',
    'game_outcomes'
  ]
  
  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('game_id', sampleGame.id)
      
      if (error) {
        if (error.code === 'PGRST204' || error.code === '42P01') {
          console.log(`- ${table}: Table doesn't exist`)
        } else {
          console.log(`- ${table}: Error - ${error.message}`)
        }
      } else {
        console.log(`- ${table}: ${count || 0} records found`)
      }
    } catch (e) {
      console.log(`- ${table}: Unknown error`)
    }
  }
  
  // Check if we can delete this game
  console.log('\n🧪 Testing deletion of sample game...')
  const { error: deleteError } = await supabase
    .from('games')
    .delete()
    .eq('id', sampleGame.id)
  
  if (deleteError) {
    console.error('❌ Cannot delete game:', deleteError)
    console.log('\nThis error suggests there may be foreign key constraints preventing deletion.')
  } else {
    console.log('✅ Successfully deleted sample game!')
    
    // Recreate it for consistency
    const { error: insertError } = await supabase
      .from('games')
      .insert({
        id: sampleGame.id,
        external_id: null
      })
    
    if (insertError) {
      console.log('Note: Could not recreate sample game')
    }
  }
}

async function checkTableStructure() {
  console.log('\n🏗️ Checking games table structure...')
  
  // Get column info
  const { data: columns, error } = await supabase
    .from('games')
    .select('*')
    .limit(1)
  
  if (!error && columns && columns.length > 0) {
    console.log('Games table columns:', Object.keys(columns[0]))
  }
}

async function main() {
  console.log('🚀 Starting dependency check for fake games...')
  console.log('Database URL:', supabaseUrl)
  
  await checkDependencies()
  await checkTableStructure()
  
  console.log('\n✅ Dependency check completed!')
}

// Run the check
main().catch(console.error)