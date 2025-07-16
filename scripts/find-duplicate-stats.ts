#!/usr/bin/env tsx
/**
 * 🔍 FIND DUPLICATE STATS
 * Check if we have duplicate player/game combinations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findDuplicateStats() {
  console.log(chalk.bold.blue('🔍 FIND DUPLICATE STATS\n'));
  
  // Theory: The unique constraint prevented duplicates
  // Let's check stats created at different times today
  
  const morningCutoff = new Date('2025-07-16T00:00:00Z');
  const afternoonCutoff = new Date('2025-07-16T12:00:00Z');
  const eveningCutoff = new Date('2025-07-16T21:30:00Z');
  
  // Count stats by time period
  const { count: morningStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', morningCutoff.toISOString())
    .lt('created_at', afternoonCutoff.toISOString());
  
  const { count: afternoonStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', afternoonCutoff.toISOString())
    .lt('created_at', eveningCutoff.toISOString());
  
  const { count: eveningStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', eveningCutoff.toISOString());
  
  console.log('Stats created today by time period:');
  console.log(`Morning (00:00-12:00): ${morningStats}`);
  console.log(`Afternoon (12:00-21:30): ${afternoonStats}`);
  console.log(`Evening (21:30+): ${eveningStats}`);
  console.log(`Total: ${(morningStats || 0) + (afternoonStats || 0) + (eveningStats || 0)}`);
  
  // Check what sports were collected in the morning
  console.log('\n📊 Morning stats by sport:');
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  
  for (const sport of sports) {
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(100);
    
    if (games && games.length > 0) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', games.map(g => g.id))
        .gte('created_at', morningCutoff.toISOString())
        .lt('created_at', afternoonCutoff.toISOString());
      
      if (count && count > 0) {
        // Get total games for estimation
        const { count: totalGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('sport', sport);
        
        const estimated = Math.round((count / 100) * (totalGames || 0));
        console.log(`${sport}: ~${estimated.toLocaleString()} stats (based on ${count} from 100 games)`);
      }
    }
  }
  
  // Check for NCAA Basketball stats created earlier today
  console.log('\n🏀 NCAA Basketball stats timeline:');
  
  const { data: ncaaBBGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(100);
  
  if (ncaaBBGames) {
    const gameIds = ncaaBBGames.map(g => g.id);
    
    const { count: morningBB } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .gte('created_at', morningCutoff.toISOString())
      .lt('created_at', eveningCutoff.toISOString());
    
    const { count: eveningBB } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .gte('created_at', eveningCutoff.toISOString());
    
    console.log(`NCAA BB stats before 21:30: ${morningBB}`);
    console.log(`NCAA BB stats after 21:30: ${eveningBB}`);
    
    // If we have morning stats, someone already collected NCAA BB today!
    if (morningBB && morningBB > 0) {
      console.log(chalk.yellow('\n⚠️  NCAA Basketball stats were already collected earlier today!'));
      console.log(chalk.yellow('The unique constraint prevented duplicates from being inserted.'));
      
      // Estimate total
      const { count: totalBBGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'NCAA_BB');
      
      const estimatedMorningTotal = Math.round((morningBB / 100) * (totalBBGames || 0));
      console.log(chalk.yellow(`Estimated ~${estimatedMorningTotal.toLocaleString()} NCAA BB stats were already in the database`));
    }
  }
}

findDuplicateStats().catch(console.error);