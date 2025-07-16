#!/usr/bin/env tsx
/**
 * 🔍 FIND MYSTERY STATS
 * Figure out where those 11,000 stats are
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMysteryStats() {
  console.log(chalk.bold.blue('🔍 FIND MYSTERY STATS\n'));
  
  // Get a sample of NCAA Basketball games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, metadata')
    .eq('sport', 'NCAA_BB')
    .limit(5);
  
  console.log('Sample NCAA Basketball games:');
  games?.forEach(game => {
    console.log(`- Game ${game.id} (${game.external_id}): ${game.metadata?.home_team} vs ${game.metadata?.away_team}`);
  });
  
  // Check stats for these specific games
  console.log('\n📊 Checking stats for these games:');
  
  for (const game of games || []) {
    const { data: stats, count } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id', { count: 'exact' })
      .eq('game_id', game.id);
    
    console.log(`Game ${game.id}: ${count || 0} stats found`);
    
    if (stats && stats.length > 0) {
      console.log('  Sample stat IDs:', stats.slice(0, 3).map(s => s.id));
      
      // Check the player for this stat
      const { data: player } = await supabase
        .from('players')
        .select('sport_id, name')
        .eq('id', stats[0].player_id)
        .single();
      
      console.log(`  Player sport: ${player?.sport_id} - ${player?.name}`);
    }
  }
  
  // Let's also check what sports have stats
  console.log('\n📊 Stats by sport:');
  
  // Get all game IDs by sport
  const sports = ['NCAA_BB', 'NCAA_FB', 'NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(100);
    
    if (sportGames && sportGames.length > 0) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', sportGames.map(g => g.id));
      
      console.log(`${sport}: ${count || 0} stats (from first 100 games)`);
    }
  }
}

findMysteryStats().catch(console.error);