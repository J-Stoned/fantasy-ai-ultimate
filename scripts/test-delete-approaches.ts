#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testDeletion() {
  // Try different approaches
  console.log('🧪 Testing deletion approaches...')
  
  // Test 1: Delete a single game
  console.log('\n1️⃣ Testing single game deletion...')
  const { data: singleGame } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
    .limit(1)
    .single()
  
  if (singleGame) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', singleGame.id)
    
    if (error) {
      console.error('❌ Single delete failed:', error.message)
    } else {
      console.log('✅ Single delete successful!')
    }
  }
  
  // Test 2: Delete small batch (5 games)
  console.log('\n2️⃣ Testing small batch (5 games)...')
  const { data: smallBatch } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
    .limit(5)
  
  if (smallBatch && smallBatch.length > 0) {
    const ids = smallBatch.map(g => g.id)
    const { error } = await supabase
      .from('games')
      .delete()
      .in('id', ids)
    
    if (error) {
      console.error('❌ Small batch failed:', error.message)
    } else {
      console.log('✅ Small batch successful!')
    }
  }
  
  // Test 3: Try deleting with a filter directly
  console.log('\n3️⃣ Testing direct filter deletion...')
  const { data, error, count } = await supabase
    .from('games')
    .delete()
    .is('external_id', null)
    .select('id')
    .limit(10)
  
  if (error) {
    console.error('❌ Direct filter delete failed:', error.message)
  } else {
    console.log(`✅ Direct filter delete successful! Deleted ${data?.length || 0} games`)
  }
  
  // Check remaining count
  const { count: remaining } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(`\n📊 Remaining fake games: ${remaining}`)
}

testDeletion().catch(console.error)