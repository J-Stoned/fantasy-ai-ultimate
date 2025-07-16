#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE GAME ID MISMATCH
 * Check if stats are using wrong game IDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateGameIdMismatch() {
  console.log(chalk.bold.red('🔍 INVESTIGATING GAME ID MISMATCH\n'));
  
  // 1. Check sample of stats and their game_ids
  console.log(chalk.bold.yellow('1. CHECKING SAMPLE STATS:'));
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('id, game_id, external_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Recent stats:');
  sampleStats?.forEach((stat, i) => {
    console.log(`${i + 1}. ID: ${stat.id}, Game ID: ${stat.game_id}, External ID: ${stat.external_id}, Created: ${stat.created_at}`);
  });
  
  // 2. Check if these game_ids exist in games table
  console.log(chalk.bold.yellow('\n2. CHECKING IF GAME IDS EXIST:'));
  const gameIds = sampleStats?.map(s => s.game_id) || [];
  
  for (const gameId of gameIds) {
    const { data: game } = await supabase
      .from('games')
      .select('id, sport, external_id')
      .eq('id', gameId)
      .single();
    
    if (game) {
      console.log(`✅ Game ${gameId} exists: ${game.sport} - ${game.external_id}`);
    } else {
      console.log(`❌ Game ${gameId} NOT FOUND in games table!`);
    }
  }
  
  // 3. Check what the actual game_id values look like
  console.log(chalk.bold.yellow('\n3. ANALYZING GAME ID PATTERNS:'));
  const { data: statsGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(1000);
  
  const uniqueGameIds = [...new Set(statsGameIds?.map(s => s.game_id) || [])];
  
  // Check if they're numbers or strings
  const sampleIds = uniqueGameIds.slice(0, 10);
  console.log('Sample game IDs from stats:');
  sampleIds.forEach((id, i) => {
    console.log(`${i + 1}. ${id} (type: ${typeof id})`);
  });
  
  // 4. Check game table ID patterns
  console.log(chalk.bold.yellow('\n4. CHECKING GAMES TABLE ID PATTERNS:'));
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, sport, external_id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  console.log('Sample NCAA_BB game IDs:');
  sampleGames?.forEach((game, i) => {
    console.log(`${i + 1}. ID: ${game.id}, External ID: ${game.external_id}`);
  });
  
  // 5. Look for external_id matches
  console.log(chalk.bold.yellow('\n5. CHECKING EXTERNAL ID MATCHES:'));
  
  // Get external IDs from recent stats
  const { data: statsWithExternal } = await supabase
    .from('player_game_logs')
    .select('external_id')
    .not('external_id', 'is', null)
    .limit(100);
  
  if (statsWithExternal && statsWithExternal.length > 0) {
    console.log(`Found ${statsWithExternal.length} stats with external_id`);
    
    // Extract game external IDs from stat external IDs
    const gameExternalIds = statsWithExternal
      .map(s => {
        // External ID might be like "espn_ncaa_bb_401234_player_5678"
        const match = s.external_id?.match(/espn_ncaa_bb_(\d+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .slice(0, 5);
    
    console.log('Extracted game IDs from stat external_ids:', gameExternalIds);
    
    // Check if these exist as game external_ids
    for (const extId of gameExternalIds) {
      const { data: game } = await supabase
        .from('games')
        .select('id, sport')
        .or(`external_id.eq.espn_ncaa_bb_${extId},external_id.eq.${extId}`)
        .single();
      
      if (game) {
        console.log(`Found game with external_id containing ${extId}: ${game.id} (${game.sport})`);
      }
    }
  }
  
  // 6. Count stats that have valid game references
  console.log(chalk.bold.yellow('\n6. COUNTING STATS WITH VALID GAME REFERENCES:'));
  
  // Get all unique game IDs from stats
  const { data: allStatsGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(10000);
  
  const allUniqueGameIds = [...new Set(allStatsGameIds?.map(s => s.game_id) || [])];
  console.log(`Total unique game IDs in stats: ${allUniqueGameIds.length}`);
  
  // Check how many exist in games table
  const { count: validGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .in('id', allUniqueGameIds.slice(0, 500)); // Check first 500
  
  console.log(`Valid games found (from first 500): ${validGamesCount}`);
  
  // 7. Check if there's a pattern in the mismatch
  console.log(chalk.bold.red('\n7. FINDING THE MISMATCH PATTERN:'));
  
  // Compare numeric vs string IDs
  const numericIds = allUniqueGameIds.filter(id => typeof id === 'number' || /^\d+$/.test(String(id)));
  const nonNumericIds = allUniqueGameIds.filter(id => !(typeof id === 'number' || /^\d+$/.test(String(id))));
  
  console.log(`Numeric IDs: ${numericIds.length}`);
  console.log(`Non-numeric IDs: ${nonNumericIds.length}`);
  
  if (nonNumericIds.length > 0) {
    console.log('Sample non-numeric IDs:', nonNumericIds.slice(0, 5));
  }
}

investigateGameIdMismatch().catch(console.error);