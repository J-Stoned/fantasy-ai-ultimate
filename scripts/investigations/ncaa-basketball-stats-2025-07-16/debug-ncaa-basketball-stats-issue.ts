#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NCAA BASKETBALL STATS ISSUE
 * Find why stats aren't being inserted properly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNCAABasketballStatsIssue() {
  console.log(chalk.bold.red('🔍 DEBUGGING NCAA BASKETBALL STATS ISSUE\n'));
  
  // 1. Check NCAA BB players
  console.log(chalk.yellow('1. NCAA Basketball Players:'));
  const { count: ncaaBBPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  console.log(`Total NCAA_BB players: ${ncaaBBPlayersCount?.toLocaleString()}`);
  
  // Get sample players
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, external_id, name, team_id')
    .eq('sport', 'NCAA_BB')
    .limit(5);
  
  console.log('\nSample NCAA_BB players:');
  samplePlayers?.forEach((player, i) => {
    console.log(`${i + 1}. ID: ${player.id}, External: ${player.external_id}, Name: ${player.name}`);
  });
  
  // 2. Check what player IDs the stats are trying to use
  console.log(chalk.yellow('\n2. Player IDs in existing stats:'));
  
  // Get NCAA BB games
  const { data: ncaaGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  if (ncaaGames && ncaaGames.length > 0) {
    const { data: existingStats } = await supabase
      .from('player_game_logs')
      .select('player_id, stats')
      .in('game_id', ncaaGames.map(g => g.id))
      .limit(10);
    
    console.log(`\nFound ${existingStats?.length || 0} existing stats`);
    
    if (existingStats && existingStats.length > 0) {
      console.log('Sample stat player IDs:');
      existingStats.slice(0, 5).forEach((stat, i) => {
        console.log(`${i + 1}. Player ID: ${stat.player_id}`);
      });
      
      // Check if these player IDs exist
      const playerIds = existingStats.map(s => s.player_id);
      const { data: foundPlayers } = await supabase
        .from('players')
        .select('id, name, sport')
        .in('id', playerIds);
      
      console.log(`\nFound ${foundPlayers?.length || 0}/${playerIds.length} players for these stats`);
      foundPlayers?.forEach(p => {
        console.log(`  Player ${p.id}: ${p.name} (${p.sport})`);
      });
    }
  }
  
  // 3. Check the player ID range
  console.log(chalk.yellow('\n3. Player ID ranges:'));
  
  // NCAA BB player ID range
  const { data: ncaaMinPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .order('id', { ascending: true })
    .limit(1);
  
  const { data: ncaaMaxPlayer } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .order('id', { ascending: false })
    .limit(1);
  
  if (ncaaMinPlayer?.[0] && ncaaMaxPlayer?.[0]) {
    console.log(`NCAA_BB player ID range: ${ncaaMinPlayer[0].id} to ${ncaaMaxPlayer[0].id}`);
  }
  
  // Check all sports player ranges
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  console.log('\nAll sports player ID ranges:');
  
  for (const sport of sports) {
    const { data: minPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('sport', sport)
      .order('id', { ascending: true })
      .limit(1);
    
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    if (minPlayer?.[0]) {
      console.log(`${sport}: Starting at ID ${minPlayer[0].id} (${count} players)`);
    }
  }
  
  // 4. Let's trace through the stats collection process
  console.log(chalk.yellow('\n4. Simulating stats collection process:'));
  
  // Get a sample game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_BB')
    .not('metadata', 'is', null)
    .single();
  
  if (sampleGame && sampleGame.metadata) {
    console.log(`\nSample game: ${sampleGame.external_id}`);
    console.log('Teams in metadata:', {
      away: sampleGame.metadata.away_team,
      home: sampleGame.metadata.home_team
    });
    
    // Check if we can find players for these teams
    const { data: awayTeam } = await supabase
      .from('teams')
      .select('id, name')
      .eq('sport', 'NCAA_BB')
      .ilike('name', `%${sampleGame.metadata.away_team}%`)
      .single();
    
    const { data: homeTeam } = await supabase
      .from('teams')
      .select('id, name')
      .eq('sport', 'NCAA_BB')
      .ilike('name', `%${sampleGame.metadata.home_team}%`)
      .single();
    
    console.log('Found teams:', {
      away: awayTeam ? `${awayTeam.name} (ID: ${awayTeam.id})` : 'NOT FOUND',
      home: homeTeam ? `${homeTeam.name} (ID: ${homeTeam.id})` : 'NOT FOUND'
    });
    
    if (awayTeam) {
      const { count: awayPlayersCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', awayTeam.id);
      
      console.log(`Away team players: ${awayPlayersCount}`);
    }
  }
  
  // 5. Final diagnosis
  console.log(chalk.bold.green('\n📊 DIAGNOSIS:'));
  console.log('The issue appears to be:');
  console.log('1. NCAA Basketball players exist (5,563 players)');
  console.log('2. But the stats collection is trying to use player IDs that don\'t exist');
  console.log('3. This could be because:');
  console.log('   - The stats API returns player IDs that don\'t match our database');
  console.log('   - Players need to be matched by name/external_id instead of ID');
  console.log('   - The collection script needs to create players on the fly');
}

debugNCAABasketballStatsIssue().catch(console.error);