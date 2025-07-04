import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testPlayerData() {
  console.log('\n🔍 TESTING PLAYER DATA STRUCTURE\n');
  
  // Check player_stats
  const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
    
  console.log('Player stats columns:', stats?.[0] ? Object.keys(stats[0]) : 'No data');
  console.log('Sample stats:', stats?.[0]);
  
  // Check if we have injuries
  const { data: injuries, error: injError } = await supabase
    .from('player_injuries')
    .select('*')
    .limit(5);
    
  console.log('\nInjury columns:', injuries?.[0] ? Object.keys(injuries[0]) : 'No data');
  console.log('Sample injury:', injuries?.[0]);
  
  // Count records
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📊 COUNTS:');
  console.log(`Players: ${playerCount}`);
  console.log(`Player stats: ${statsCount}`);
  console.log(`Injuries: ${injuries?.length || 0}`);
}

testPlayerData().catch(console.error);