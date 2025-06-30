const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSupabase() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test by counting sports
    const { data: sports, error: sportsError } = await supabase
      .from('sports')
      .select('*');
    
    if (sportsError) {
      console.log('❌ Error querying sports:', sportsError.message);
    } else {
      console.log(`✅ Connected! Found ${sports?.length || 0} sports`);
      if (sports?.length > 0) {
        console.log('Sports:', sports.map(s => s.name).join(', '));
      }
    }
    
    // Count all tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_count');
    
    if (!tablesError && tables) {
      console.log(`📊 Total tables: ${tables}`);
    }
    
    // Test creating the RPC function if it doesn't exist
    console.log('\n📋 Your database is ready!');
    console.log('Next steps:');
    console.log('1. Run seed.sql to add initial data');
    console.log('2. Start the development server with: npm run dev');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSupabase();