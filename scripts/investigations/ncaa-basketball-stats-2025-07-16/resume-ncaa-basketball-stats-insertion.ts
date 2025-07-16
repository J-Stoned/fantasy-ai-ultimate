#!/usr/bin/env tsx
/**
 * 🏀 RESUME NCAA BASKETBALL STATS INSERTION
 * Check what happened and resume if needed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resumeNCAABasketballStatsInsertion() {
  console.log(chalk.bold.blue('🏀 CHECKING NCAA BASKETBALL STATS INSERTION STATUS\n'));
  
  // Current status
  const { count: currentNCAABBStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', (await supabase.from('games').select('id').eq('sport', 'NCAA_BB').limit(1000)).data?.map(g => g.id) || []);
  
  console.log(`Current NCAA Basketball stats in database: ${currentNCAABBStats?.toLocaleString()}`);
  console.log(`Expected from collection: 156,792`);
  console.log(chalk.red(`Missing: ${156792 - (currentNCAABBStats || 0)} stats\n`));
  
  // Check for duplicate key pattern
  console.log(chalk.yellow('Checking for potential duplicate key issues...'));
  
  // Get a sample NCAA BB game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, external_id, metadata')
    .eq('sport', 'NCAA_BB')
    .single();
  
  if (sampleGame) {
    console.log(`\nSample game: ${sampleGame.external_id}`);
    
    // Check player_game_logs structure
    const { data: sampleStats } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, external_id, created_at')
      .eq('game_id', sampleGame.id)
      .limit(5);
    
    console.log(`Stats for this game: ${sampleStats?.length || 0}`);
    
    if (sampleStats && sampleStats.length > 0) {
      console.log('\nSample stat structure:');
      console.log({
        id: sampleStats[0].id,
        player_id: sampleStats[0].player_id,
        game_id: sampleStats[0].game_id,
        external_id: sampleStats[0].external_id,
        created_at: sampleStats[0].created_at
      });
    }
  }
  
  // Check if there's a unique constraint issue
  console.log(chalk.yellow('\n🔍 Analyzing potential issues:'));
  
  // 1. Check if external_id is being set
  const { data: statsWithExternal } = await supabase
    .from('player_game_logs')
    .select('external_id')
    .not('external_id', 'is', null)
    .limit(10);
  
  console.log(`Stats with external_id: ${statsWithExternal?.length || 0} (sample of 10)`);
  
  // 2. Check for NCAA BB players
  const { count: ncaaBBPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  console.log(`NCAA Basketball players in database: ${ncaaBBPlayers?.toLocaleString()}`);
  
  // 3. Look for the pattern of what's failing
  console.log(chalk.yellow('\n📊 Checking insertion patterns:'));
  
  // Get games with different stat counts
  const { data: ncaaGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(50);
  
  if (ncaaGames) {
    const statCounts: Record<number, number> = {};
    
    for (const game of ncaaGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      const statCount = count || 0;
      statCounts[statCount] = (statCounts[statCount] || 0) + 1;
    }
    
    console.log('Stats per game distribution (sample of 50 games):');
    Object.entries(statCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([count, games]) => {
        console.log(`  ${count} stats: ${games} games`);
      });
  }
  
  // Suggest next steps
  console.log(chalk.bold.green('\n💡 RECOMMENDATIONS:'));
  
  if ((currentNCAABBStats || 0) < 50000) {
    console.log(chalk.yellow('1. The batch insertion likely failed due to:'));
    console.log('   - Missing external_id constraints');
    console.log('   - Player ID mismatches');
    console.log('   - Duplicate key constraints');
    console.log('\n2. To fix this, we should:');
    console.log('   - Re-run the collection script with better error handling');
    console.log('   - Or create a new script that generates proper external_ids');
    console.log('   - Or temporarily remove unique constraints during insertion');
  } else {
    console.log(chalk.green('✅ Most stats appear to be inserted successfully!'));
  }
  
  // Check the unique constraints on the table
  console.log(chalk.yellow('\n🔐 Checking table constraints...'));
  
  // This would normally require querying the information_schema, but let's check for duplicates
  const { data: duplicateCheck } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id')
    .in('game_id', ncaaGames?.slice(0, 10).map(g => g.id) || [])
    .limit(100);
  
  if (duplicateCheck) {
    const seen = new Set();
    let duplicates = 0;
    
    duplicateCheck.forEach(stat => {
      const key = `${stat.player_id}-${stat.game_id}`;
      if (seen.has(key)) {
        duplicates++;
      }
      seen.add(key);
    });
    
    console.log(`Duplicate player-game combinations found: ${duplicates}`);
  }
}

resumeNCAABasketballStatsInsertion().catch(console.error);