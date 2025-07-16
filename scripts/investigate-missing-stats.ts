#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE MISSING STATS
 * Find out what happened to our NCAA Basketball stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateMissingStats() {
  console.log(chalk.bold.blue('🔍 INVESTIGATE MISSING STATS\n'));
  
  // Check total before and after
  console.log('Stats count BEFORE we added NCAA Basketball: 518,646');
  console.log('Stats count AFTER we added NCAA Basketball: 519,536');
  console.log('Difference: 890 stats (expected 156,782!)\n');
  
  // Let's check if there are NCAA Basketball players in non-NCAA_BB games
  const { data: ncaaBBPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'NCAA_BB')
    .limit(100);
  
  if (ncaaBBPlayers && ncaaBBPlayers.length > 0) {
    const playerIds = ncaaBBPlayers.map(p => p.id);
    
    // Count stats for these players
    const { count: playerStatsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', playerIds);
    
    console.log(`Stats for first 100 NCAA_BB players: ${playerStatsCount}`);
    
    // Get a sample of these stats
    const { data: sampleStats } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id')
      .in('player_id', playerIds.slice(0, 10))
      .limit(10);
    
    if (sampleStats && sampleStats.length > 0) {
      console.log('\nChecking which games these stats belong to:');
      
      for (const stat of sampleStats) {
        const { data: game } = await supabase
          .from('games')
          .select('sport, external_id')
          .eq('id', stat.game_id)
          .single();
        
        console.log(`Player ${stat.player_id} has stats in game ${stat.game_id} (${game?.sport})`);
      }
    }
  }
  
  // Check most recent stats
  console.log('\n📊 Most recent stats added:');
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('id, created_at, player_id, game_id')
    .order('created_at', { ascending: false })
    .limit(5);
  
  for (const stat of recentStats || []) {
    const { data: game } = await supabase
      .from('games')
      .select('sport')
      .eq('id', stat.game_id)
      .single();
    
    console.log(`Stat ${stat.id} created at ${stat.created_at} for ${game?.sport} game`);
  }
  
  // Check if there's a transaction issue
  console.log('\n🔍 Checking for duplicate key issues:');
  const { data: ncaaBBGame } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(1)
    .single();
  
  if (ncaaBBGame) {
    const { data: gameStats } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .eq('game_id', ncaaBBGame.id);
    
    console.log(`Game ${ncaaBBGame.id} has ${gameStats?.length || 0} stats`);
  }
}

investigateMissingStats().catch(console.error);