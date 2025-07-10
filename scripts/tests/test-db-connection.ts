#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

async function testConnection() {
  console.log('🔍 Testing database connections...\n')

  // Test Prisma connection
  console.log('1️⃣ Testing Prisma connection...')
  const prisma = new PrismaClient()
  
  try {
    await prisma.$connect()
    const playerCount = await prisma.player.count()
    console.log('✅ Prisma connected successfully!')
    console.log(`   Found ${playerCount} players in database\n`)
  } catch (error) {
    console.error('❌ Prisma connection failed:', error)
    console.log('   Check your DATABASE_URL in .env.local\n')
  } finally {
    await prisma.$disconnect()
  }

  // Test Supabase connection
  console.log('2️⃣ Testing Supabase client...')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing!')
    console.log('   Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local\n')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    const { data, error } = await supabase.from('players').select('count').limit(1)
    if (error) throw error
    
    console.log('✅ Supabase connected successfully!\n')
  } catch (error) {
    console.error('❌ Supabase connection failed:', error)
    console.log('   Check your Supabase credentials\n')
  }

  // Show next steps
  console.log('📋 Next steps:')
  console.log('   1. Run migrations in Supabase SQL editor')
  console.log('   2. Start the dev server: npx nx dev web')
  console.log('   3. Visit http://localhost:3000')
  console.log('   4. Create an account and start importing leagues!')
}

// Run the test
testConnection().catch(console.error)