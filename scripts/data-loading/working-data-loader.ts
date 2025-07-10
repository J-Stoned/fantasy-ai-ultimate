#!/usr/bin/env tsx
/**
 * WORKING DATA LOADER - Final version
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.green.bold('\n✅ WORKING DATA LOADER'));
console.log(chalk.green('======================\n'));

async function checkAndLoadData() {
  // First, let's check what columns exist
  console.log(chalk.yellow('Checking player table structure...'));
  
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('*')
    .limit(1)
    .single();
  
  if (samplePlayer) {
    console.log('Player columns:', Object.keys(samplePlayer));
  }
  
  // Load more teams (NBA, MLB, NHL)
  console.log(chalk.yellow('\nLoading more sports teams...'));
  
  const sports = [
    { name: 'Los Angeles Lakers', city: 'Los Angeles', abbreviation: 'LAL', sport_id: 'nba', league_id: 'NBA' },
    { name: 'Boston Celtics', city: 'Boston', abbreviation: 'BOS', sport_id: 'nba', league_id: 'NBA' },
    { name: 'Golden State Warriors', city: 'Golden State', abbreviation: 'GSW', sport_id: 'nba', league_id: 'NBA' },
    { name: 'Miami Heat', city: 'Miami', abbreviation: 'MIA', sport_id: 'nba', league_id: 'NBA' },
    { name: 'New York Yankees', city: 'New York', abbreviation: 'NYY', sport_id: 'mlb', league_id: 'MLB' },
    { name: 'Los Angeles Dodgers', city: 'Los Angeles', abbreviation: 'LAD', sport_id: 'mlb', league_id: 'MLB' },
    { name: 'Boston Red Sox', city: 'Boston', abbreviation: 'BOS', sport_id: 'mlb', league_id: 'MLB' },
    { name: 'Toronto Maple Leafs', city: 'Toronto', abbreviation: 'TOR', sport_id: 'nhl', league_id: 'NHL' },
    { name: 'New York Rangers', city: 'New York', abbreviation: 'NYR', sport_id: 'nhl', league_id: 'NHL' }
  ];
  
  let teamsAdded = 0;
  for (const team of sports) {
    const { error } = await supabase.from('teams').insert(team);
    if (!error) teamsAdded++;
  }
  
  console.log(chalk.green(`✅ Added ${teamsAdded} more teams!`));
  
  // Create sample games
  console.log(chalk.yellow('\nCreating sample games...'));
  
  const { data: nflTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(10);
  
  if (nflTeams && nflTeams.length >= 2) {
    let gamesAdded = 0;
    
    // Create some sample games
    for (let i = 0; i < Math.min(5, nflTeams.length - 1); i++) {
      const game = {
        home_team_id: nflTeams[i].id,
        away_team_id: nflTeams[i + 1].id,
        sport_id: 'nfl',
        start_time: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(), // Games over next 5 days
        venue: 'Stadium',
        status: i === 0 ? 'In Progress' : 'Scheduled'
      };
      
      const { error } = await supabase.from('games').insert(game);
      if (!error) gamesAdded++;
    }
    
    console.log(chalk.green(`✅ Created ${gamesAdded} sample games!`));
  }
  
  // Final summary
  console.log(chalk.blue.bold('\n📊 FINAL DATABASE SUMMARY:'));
  
  const tables = ['teams', 'players', 'news_articles', 'games'];
  let grandTotal = 0;
  
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count || 0}`);
    grandTotal += (count || 0);
  }
  
  console.log(chalk.green.bold(`\n  GRAND TOTAL: ${grandTotal} records! 🎉`));
  
  if (grandTotal > 500) {
    console.log(chalk.cyan('\n✨ Excellent! Your database has plenty of data!'));
    console.log(chalk.cyan('✨ The app can now display real sports information!'));
  } else {
    console.log(chalk.yellow('\n📈 Your database has a good start!'));
    console.log(chalk.yellow('📈 Data collection scripts will add more over time.'));
  }
}

checkAndLoadData().catch(console.error);