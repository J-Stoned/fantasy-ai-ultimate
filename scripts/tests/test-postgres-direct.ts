#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Testing Supabase Connection Methods\n');

// Parse connection details from DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:${DB_PASSWORD}@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Connection Details:');
console.log('- Database URL:', DATABASE_URL.substring(0, 50) + '...');
console.log('- Supabase URL:', SUPABASE_URL);
console.log('- Project Ref:', SUPABASE_URL.split('.')[0].split('//')[1]);
console.log('');

async function testSupabaseREST() {
  console.log('1️⃣ Testing Supabase REST API...');
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Try to fetch from a system table
    const { data, error } = await supabase
      .from('players')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ REST API Error:', error.message);
      
      // Try auth endpoint as alternative test
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (!authError) {
        console.log('✅ Auth endpoint works - Supabase is reachable');
        console.log('   But database queries are failing');
      }
    } else {
      console.log('✅ REST API connected successfully!');
    }
  } catch (err: any) {
    console.log('❌ Connection failed:', err.message);
  }
  console.log('');
}

async function testDatabaseStatus() {
  console.log('2️⃣ Checking Database Status via API...');
  
  try {
    // Test the Supabase status endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('   API Response Status:', response.status);
    
    if (response.status === 404) {
      console.log('   ✅ Supabase project exists and is responding');
    }
    
    // Try health check
    const healthResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/health_check`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (healthResponse.ok) {
      console.log('   Health check passed');
    } else {
      console.log('   Health check status:', healthResponse.status);
    }
  } catch (err: any) {
    console.log('   Error checking status:', err.message);
  }
  console.log('');
}

async function checkProjectStatus() {
  console.log('3️⃣ Diagnosing Connection Issue...\n');
  
  console.log('⚠️  LIKELY ISSUE: Database is paused!');
  console.log('');
  console.log('📋 To fix this:');
  console.log('1. Go to: https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup');
  console.log('2. Look for a "Database paused" message');
  console.log('3. Click "Restore" or "Unpause" button');
  console.log('4. Wait 1-2 minutes for database to start');
  console.log('5. Run this test again');
  console.log('');
  console.log('Alternative issues:');
  console.log('- WSL2 network configuration blocking port 5432');
  console.log('- Firewall rules blocking PostgreSQL connections');
  console.log('- VPN interfering with connections');
}

// Run all tests
async function runTests() {
  await testSupabaseREST();
  await testDatabaseStatus();
  await checkProjectStatus();
}

runTests().catch(console.error);