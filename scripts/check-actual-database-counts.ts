#!/usr/bin/env tsx
/**
 * 📊 CHECK ACTUAL DATABASE COUNTS
 * Verify true counts with proper pagination
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkActualCounts() {
  console.log(chalk.bold.blue('📊 CHECKING ACTUAL DATABASE COUNTS\n'));
  
  // Method 1: Use count query (most reliable)
  console.log('Method 1: Direct count query');
  const { count: directCount, error: countError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'NCAA_FB');
  
  if (countError) {
    console.error('Count error:', countError);
  } else {
    console.log(`Direct count: ${directCount} players`);
  }
  
  // Method 2: Paginate through all records
  console.log('\nMethod 2: Pagination through all records');
  let totalPlayers = 0;
  let from = 0;
  const batchSize = 1000;
  let batchCount = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('sport_id', 'NCAA_FB')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Pagination error:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    batchCount++;
    totalPlayers += data.length;
    console.log(`Batch ${batchCount}: ${data.length} players (total: ${totalPlayers})`);
    
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`\nPagination result: ${totalPlayers} players`);
  
  // Method 3: Check unique team coverage
  console.log('\nMethod 3: Check team coverage');
  const { data: teamData, error: teamError } = await supabase
    .from('players')
    .select('team_id')
    .eq('sport_id', 'NCAA_FB');
  
  if (teamError) {
    console.error('Team error:', teamError);
  } else {
    const uniqueTeams = new Set(teamData.map(p => p.team_id));
    console.log(`Players fetched: ${teamData.length}`);
    console.log(`Unique teams: ${uniqueTeams.size}`);
  }
  
  // Method 4: Check stats count
  console.log('\nMethod 4: Check stats count');
  const { count: statsCount, error: statsError } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', 
      await supabase
        .from('games')
        .select('id')
        .eq('sport', 'NCAA_FB')
        .then(res => res.data?.map(g => g.id) || [])
    );
  
  if (statsError) {
    console.error('Stats error:', statsError);
  } else {
    console.log(`NCAA Football stats: ${statsCount}`);
  }
  
  // Summary
  console.log('\n' + chalk.bold.yellow('📊 SUMMARY:'));
  console.log(`Direct count: ${directCount || 'ERROR'}`);
  console.log(`Pagination count: ${totalPlayers}`);
  console.log(`Stats count: ${statsCount || 'ERROR'}`);
  
  if (directCount !== totalPlayers) {
    console.log(chalk.bold.red('\n🚨 MISMATCH DETECTED!'));
    console.log('Direct count and pagination count do not match.');
    console.log('This suggests a query limit or pagination issue.');
  }
}

checkActualCounts().catch(console.error);