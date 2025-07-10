#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigatePlayerStats() {
  console.log('🔍 INVESTIGATING PLAYER_STATS DISTRIBUTION\n');
  console.log('━'.repeat(50));
  
  try {
    // Count total player_stats
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total player_stats records: ${totalStats?.toLocaleString()}`);
    
    // Check distribution by game_id
    console.log('\n🎮 Checking game_id distribution...');
    
    // Get sample of game_ids
    const { data: gameIdSample, error: sampleError } = await supabase
      .from('player_stats')
      .select('game_id, count')
      .limit(1000);
    
    if (sampleError) throw sampleError;
    
    // Count NULL game_ids
    const { count: nullGameIds } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null);
    
    console.log(`├─ Records with NULL game_id: ${nullGameIds?.toLocaleString()}`);
    console.log(`└─ Records with game_id: ${((totalStats || 0) - (nullGameIds || 0)).toLocaleString()}`);
    
    // Get distinct non-null game_ids
    const { data: distinctGames } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .limit(10000);
    
    const uniqueGameIds = [...new Set(distinctGames?.map(g => g.game_id))];
    console.log(`\n📈 Unique game_ids found: ${uniqueGameIds.length}`);
    
    // Check if these game_ids exist in games table
    console.log('\n🔗 Checking game_id validity...');
    
    const sampleIds = uniqueGameIds.slice(0, 100);
    const { data: validGames, error: validError } = await supabase
      .from('games')
      .select('id')
      .in('id', sampleIds);
    
    if (!validError) {
      console.log(`├─ Sample size: ${sampleIds.length}`);
      console.log(`└─ Valid games found: ${validGames?.length || 0}`);
    }
    
    // Check stat_type distribution
    console.log('\n📊 Stat type distribution:');
    const { data: statTypes } = await supabase
      .from('player_stats')
      .select('stat_type')
      .limit(1000);
    
    const statTypeCount: Record<string, number> = {};
    statTypes?.forEach(s => {
      statTypeCount[s.stat_type] = (statTypeCount[s.stat_type] || 0) + 1;
    });
    
    Object.entries(statTypeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(`├─ ${type}: ${count}`);
      });
    
    // Check player_id distribution
    console.log('\n👤 Player distribution:');
    const { data: playerSample } = await supabase
      .from('player_stats')
      .select('player_id')
      .limit(1000);
    
    const uniquePlayers = new Set(playerSample?.map(p => p.player_id));
    console.log(`└─ Unique players in sample: ${uniquePlayers.size}`);
    
    // Get creation dates
    console.log('\n📅 Data freshness:');
    const { data: dateRange } = await supabase
      .from('player_stats')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (dateRange && dateRange[0]) {
      console.log(`└─ Latest record: ${new Date(dateRange[0].created_at).toLocaleDateString()}`);
    }
    
    // Check if we need to look elsewhere
    console.log('\n💡 HYPOTHESIS:');
    if ((nullGameIds || 0) > totalStats! * 0.9) {
      console.log('❗ Most player_stats records have NULL game_id!');
      console.log('   This data might be season aggregates, not game-specific stats.');
      
      // Check stat_value structure
      const { data: sampleValues } = await supabase
        .from('player_stats')
        .select('stat_value')
        .limit(5);
      
      console.log('\n   Sample stat_values:');
      sampleValues?.forEach((v, i) => {
        console.log(`   ${i + 1}: ${JSON.stringify(v.stat_value)}`);
      });
    } else {
      console.log('✅ Most records have game_id, proceed with transformation');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run investigation
investigatePlayerStats();