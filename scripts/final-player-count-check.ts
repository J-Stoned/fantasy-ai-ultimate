import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalPlayerCountCheck() {
  console.log('🎯 Final player count verification...\n');

  // 1. Get ALL player_ids without ordering (which might be the issue)
  console.log('Method 1: Fetching player IDs in batches...');
  
  const uniquePlayers = new Set<number>();
  let hasMore = true;
  let offset = 0;
  const batchSize = 50000;
  
  while (hasMore && offset < 300000) { // Safety limit
    const { data: batch, error } = await supabase
      .from('player_stats')
      .select('player_id')
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      console.error('Error:', error);
      break;
    }
    
    if (batch && batch.length > 0) {
      batch.forEach(record => {
        if (record.player_id !== null) {
          uniquePlayers.add(record.player_id);
        }
      });
      
      console.log(`  Processed ${offset + batch.length} records, found ${uniquePlayers.size} unique players so far...`);
      
      if (batch.length < batchSize) {
        hasMore = false;
      }
      offset += batchSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`\n✅ FINAL COUNT: ${uniquePlayers.size} unique players`);
  
  // Show first 50 player IDs
  const playerArray = Array.from(uniquePlayers);
  console.log(`\nFirst 50 player IDs: ${playerArray.slice(0, 50).join(', ')}`);
  
  // 2. Get player details for a sample
  const sampleIds = playerArray.slice(0, 20);
  const { data: playerDetails } = await supabase
    .from('players')
    .select('id, firstname, lastname, sport_id')
    .in('id', sampleIds);
  
  if (playerDetails) {
    console.log('\nSample player details:');
    playerDetails.forEach(player => {
      console.log(`  - ${player.id}: ${player.firstname} ${player.lastname} (${player.sport_id})`);
    });
  }
  
  // 3. Stats breakdown by sport
  console.log('\n\nBreaking down by sport...');
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  for (const sport of sports) {
    // Get player IDs for this sport
    const { data: sportPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('sport_id', sport)
      .limit(5000);
    
    if (sportPlayers) {
      const sportPlayerIds = new Set(sportPlayers.map(p => p.id));
      const playersWithStats = playerArray.filter(id => sportPlayerIds.has(id));
      
      console.log(`${sport.toUpperCase()}: ${playersWithStats.length} players with stats (out of ${sportPlayers.length} checked)`);
    }
  }
  
  // 4. Summary
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const coverage = totalPlayers ? (uniquePlayers.size / totalPlayers * 100).toFixed(2) : 0;
  
  console.log('\n\n📊 FINAL SUMMARY:');
  console.log(`Total players in database: ${totalPlayers?.toLocaleString()}`);
  console.log(`Players with stats: ${uniquePlayers.size.toLocaleString()}`);
  console.log(`Coverage: ${coverage}%`);
  
  if (uniquePlayers.size > 100) {
    console.log('\n✅ SUCCESS: Found significant player coverage!');
    console.log('The stats collector has been working correctly.');
  } else {
    console.log('\n⚠️  WARNING: Low player coverage detected.');
  }
}

finalPlayerCountCheck().catch(console.error);