#!/usr/bin/env tsx
/**
 * 🕐 INVESTIGATE STATS TIMELINE
 * Figure out what happened to the missing stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateStatsTimeline() {
  console.log(chalk.bold.blue('🕐 INVESTIGATE STATS TIMELINE\n'));
  
  // Check stats created today
  const today = new Date('2025-07-16T00:00:00Z');
  const ncaaBBTime = new Date('2025-07-16T21:30:00Z');
  
  // Count stats created today before NCAA BB collection
  const { count: beforeNCAABB } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())
    .lt('created_at', ncaaBBTime.toISOString());
  
  console.log(`Stats created today BEFORE NCAA BB collection (before 21:30): ${beforeNCAABB}`);
  
  // Count stats created during/after NCAA BB collection
  const { count: afterNCAABB } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', ncaaBBTime.toISOString());
  
  console.log(`Stats created AFTER 21:30 (NCAA BB time): ${afterNCAABB}`);
  
  // Check for stats with old created_at dates
  const { count: oldStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', '2025-07-01');
  
  console.log(`\nStats created before July 2025: ${oldStats}`);
  
  // Group by sport to see distribution
  console.log('\n📊 Checking stats by sport and creation time:');
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    // Get sample games
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(50);
    
    if (games && games.length > 0) {
      // Count old stats
      const { count: oldCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', games.map(g => g.id))
        .lt('created_at', '2025-07-01');
      
      // Count recent stats
      const { count: recentCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', games.map(g => g.id))
        .gte('created_at', today.toISOString());
      
      console.log(`${sport}: ${oldCount} old stats, ${recentCount} created today (sample of 50 games)`);
    }
  }
  
  // Check for any deletion patterns
  console.log('\n🔍 Checking for patterns in existing stats:');
  
  // Sample some old stats to see their structure
  const { data: sampleOldStats } = await supabase
    .from('player_game_logs')
    .select('id, created_at, updated_at')
    .lt('created_at', '2025-07-01')
    .limit(5);
  
  console.log('Sample old stats:');
  sampleOldStats?.forEach(stat => {
    console.log(`- ID: ${stat.id}, Created: ${stat.created_at}, Updated: ${stat.updated_at}`);
  });
  
  // Check if we have any stats with updated_at = today but created_at = old
  const { count: updatedToday } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', today.toISOString())
    .lt('created_at', today.toISOString());
  
  console.log(`\nStats updated today but created earlier: ${updatedToday}`);
  
  // Theory: Check if stats were replaced (same player/game combination)
  console.log('\n🔄 Checking for replaced stats:');
  
  // Get a sample NCAA BB game
  const { data: ncaaBBGame } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(1)
    .single();
  
  if (ncaaBBGame) {
    const { data: gameStats } = await supabase
      .from('player_game_logs')
      .select('player_id, created_at')
      .eq('game_id', ncaaBBGame.id)
      .order('created_at');
    
    console.log(`Sample NCAA BB game has ${gameStats?.length} stats`);
    if (gameStats && gameStats.length > 0) {
      console.log(`First stat created at: ${gameStats[0].created_at}`);
      console.log(`Last stat created at: ${gameStats[gameStats.length - 1].created_at}`);
    }
  }
}

investigateStatsTimeline().catch(console.error);