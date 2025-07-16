#!/usr/bin/env tsx
/**
 * 🧹 NCAA FOOTBALL DATA CLEANUP
 * Removes all test data in the correct order to avoid foreign key constraints
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('🧹 NCAA FOOTBALL DATA CLEANUP\n'));

async function cleanupNCAAFootballData() {
  try {
    // Step 1: Count existing data
    console.log('📊 Counting existing NCAA Football data...');
    
    const { count: statsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', 
        await supabase
          .from('games')
          .select('id')
          .eq('sport', 'NCAA_FB')
          .then(res => res.data?.map(g => g.id) || [])
      );
    
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_FB');
    
    const { count: playersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'NCAA_FB');
    
    const { count: teamsCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_FB');
    
    console.log(`Found:
  - ${statsCount || 0} stats
  - ${gamesCount || 0} games
  - ${playersCount || 0} players
  - ${teamsCount || 0} teams\n`);
    
    // Step 2: Delete stats first
    console.log('🗑️  Deleting player stats...');
    const gameIds = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NCAA_FB')
      .then(res => res.data?.map(g => g.id) || []);
    
    if (gameIds.length > 0) {
      // Delete in batches
      for (let i = 0; i < gameIds.length; i += 500) {
        const batch = gameIds.slice(i, i + 500);
        const { error } = await supabase
          .from('player_game_logs')
          .delete()
          .in('game_id', batch);
        
        if (error) console.error('Error deleting stats:', error);
      }
    }
    console.log('✅ Stats deleted');
    
    // Step 3: Delete games
    console.log('🗑️  Deleting games...');
    const { error: gamesError } = await supabase
      .from('games')
      .delete()
      .eq('sport', 'NCAA_FB');
    
    if (gamesError) console.error('Error deleting games:', gamesError);
    else console.log('✅ Games deleted');
    
    // Step 4: Delete players
    console.log('🗑️  Deleting players...');
    const { error: playersError } = await supabase
      .from('players')
      .delete()
      .eq('sport_id', 'NCAA_FB');
    
    if (playersError) console.error('Error deleting players:', playersError);
    else console.log('✅ Players deleted');
    
    // Step 5: Delete teams
    console.log('🗑️  Deleting teams...');
    const { error: teamsError } = await supabase
      .from('teams')
      .delete()
      .eq('sport', 'NCAA_FB');
    
    if (teamsError) console.error('Error deleting teams:', teamsError);
    else console.log('✅ Teams deleted');
    
    console.log(chalk.green('\n✅ NCAA Football data cleanup complete!'));
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run cleanup
cleanupNCAAFootballData()
  .then(() => {
    console.log('\n👋 Cleanup finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });