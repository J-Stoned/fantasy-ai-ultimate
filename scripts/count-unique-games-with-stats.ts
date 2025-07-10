#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function countUniqueGamesWithStats() {
  console.log('🎯 COUNTING UNIQUE GAMES WITH PLAYER STATS\n');
  console.log('━'.repeat(50));
  
  try {
    // Get all unique game_ids in batches
    console.log('📊 Fetching unique game IDs...');
    
    const uniqueGameIds = new Set<number>();
    let offset = 0;
    const batchSize = 10000;
    
    while (true) {
      const { data, error } = await supabase
        .from('player_stats')
        .select('game_id')
        .range(offset, offset + batchSize - 1);
      
      if (error) throw error;
      
      if (!data || data.length === 0) break;
      
      data.forEach(row => uniqueGameIds.add(row.game_id));
      
      console.log(`Processed ${offset + data.length} records, found ${uniqueGameIds.size} unique games so far...`);
      
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    
    console.log(`\n✅ Total unique games with stats: ${uniqueGameIds.size.toLocaleString()}`);
    
    // Check how many are valid in games table
    console.log('\n🔍 Checking validity against games table...');
    
    // Convert to array and check a sample
    const gameIdArray = Array.from(uniqueGameIds);
    const sampleSize = Math.min(1000, gameIdArray.length);
    const sampleIds = gameIdArray.slice(0, sampleSize);
    
    const { data: validGames, error: validError } = await supabase
      .from('games')
      .select('id')
      .in('id', sampleIds);
    
    if (!validError) {
      const validRate = (validGames?.length || 0) / sampleSize;
      console.log(`Sample validity rate: ${(validRate * 100).toFixed(1)}%`);
      console.log(`Estimated valid games: ${Math.floor(uniqueGameIds.size * validRate).toLocaleString()}`);
    }
    
    // Check games table stats
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('home_score', 'is', null);
    
    console.log(`\n📈 Coverage Analysis:`);
    console.log(`├─ Completed games in DB: ${completedGames?.toLocaleString()}`);
    console.log(`├─ Games with player stats: ${uniqueGameIds.size.toLocaleString()}`);
    console.log(`└─ Coverage: ${((uniqueGameIds.size / (completedGames || 1)) * 100).toFixed(1)}%`);
    
    console.log('\n💰 IMPACT:');
    console.log(`Current accuracy: 65.2%`);
    const newAccuracy = 65.2 + (11.2 * uniqueGameIds.size / 50399);
    console.log(`Potential accuracy: ${Math.min(newAccuracy, 76.4).toFixed(1)}%`);
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Transform all these player_stats to player_game_logs');
    console.log('2. Link to pattern detection system');
    console.log('3. Achieve 76.4% accuracy target!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

countUniqueGamesWithStats();