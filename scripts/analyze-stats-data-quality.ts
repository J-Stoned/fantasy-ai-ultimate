#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function analyzeStatsDataQuality() {
  console.log('📊 ANALYZING STATS DATA QUALITY AND USABILITY\n');
  console.log('━'.repeat(60));
  
  try {
    // 1. Check player_stats table
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 PLAYER_STATS TABLE:`);
    console.log(`└─ Total records: ${totalStats?.toLocaleString()}\n`);
    
    // 2. Check stat types distribution
    const { data: statTypes, error: statError } = await supabase
      .from('player_stats')
      .select('stat_type')
      .limit(10000);
    
    if (!statError && statTypes) {
      const typeCount: Record<string, number> = {};
      statTypes.forEach(s => {
        const type = s.stat_type || 'null';
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      
      console.log(`📊 STAT TYPES DISTRIBUTION (sample of 10k):`);
      Object.entries(typeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([type, count]) => {
          console.log(`├─ ${type}: ${count}`);
        });
    }
    
    // 3. Check games with player stats
    const { data: gamesWithStats, error: gamesError } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(50000);
    
    if (!gamesError && gamesWithStats) {
      const uniqueGames = new Set(gamesWithStats.map(g => g.game_id));
      console.log(`\n🎮 GAMES WITH STATS:`);
      console.log(`└─ Unique games: ${uniqueGames.size}\n`);
    }
    
    // 4. Check player_game_logs
    const { count: totalGameLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: logsWithStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats', 'is', null);
    
    // Sample to check if stats are empty objects
    const { data: sampleLogs, error: sampleError } = await supabase
      .from('player_game_logs')
      .select('stats')
      .not('stats', 'is', null)
      .limit(100);
    
    let emptyStatsCount = 0;
    let populatedStatsCount = 0;
    
    if (!sampleError && sampleLogs) {
      sampleLogs.forEach(log => {
        if (log.stats && Object.keys(log.stats).length > 0) {
          populatedStatsCount++;
        } else {
          emptyStatsCount++;
        }
      });
    }
    
    console.log(`📋 PLAYER_GAME_LOGS TABLE:`);
    console.log(`├─ Total records: ${totalGameLogs?.toLocaleString()}`);
    console.log(`├─ Records with stats field: ${logsWithStats?.toLocaleString()}`);
    console.log(`├─ Sample check (100 records):`);
    console.log(`│  ├─ Empty stats objects: ${emptyStatsCount}`);
    console.log(`│  └─ Populated stats: ${populatedStatsCount}`);
    console.log(`└─ Estimated truly populated: ${Math.round((populatedStatsCount / 100) * (logsWithStats || 0))}\n`);
    
    // 5. Check specific stat availability
    const statChecks = ['points', 'minutes', 'fantasy_points', 'fantasy_total'];
    console.log(`🔍 CHECKING KEY STAT AVAILABILITY:`);
    
    for (const statType of statChecks) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('stat_type', statType);
      
      console.log(`├─ ${statType}: ${count?.toLocaleString() || 0} records`);
    }
    
    // 6. Sample some actual stats to see data format
    console.log(`\n📝 SAMPLE PLAYER_STATS RECORDS:`);
    const { data: sampleStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5);
    
    sampleStats?.forEach((stat, i) => {
      console.log(`\n${i + 1}. Player: ${stat.player_id}, Game: ${stat.game_id}`);
      console.log(`   Type: ${stat.stat_type}, Value: ${stat.stat_value}`);
      console.log(`   Fantasy Points: ${stat.fantasy_points || 'N/A'}`);
    });
    
    // 7. Final recommendations
    console.log(`\n🎯 RECOMMENDATIONS TO MAKE STATS USABLE:`);
    console.log(`\n1. IMMEDIATE FIX - Transform existing data:`);
    console.log(`   - Aggregate player_stats by player_id + game_id`);
    console.log(`   - Update empty stats objects in player_game_logs`);
    console.log(`   - Focus on games that have scores (${totalStats} stats available)`);
    
    console.log(`\n2. ALTERNATIVE APPROACH - Direct usage:`);
    console.log(`   - Modify ML scripts to JOIN player_stats directly`);
    console.log(`   - Skip the JSON transformation entirely`);
    console.log(`   - Use SQL aggregation in queries`);
    
    console.log(`\n3. FUTURE COLLECTION - Fix at source:`);
    console.log(`   - Update scrapers to populate both tables`);
    console.log(`   - Ensure stats JSON is created during collection`);
    console.log(`   - Add validation to prevent empty stats\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run analysis
analyzeStatsDataQuality();