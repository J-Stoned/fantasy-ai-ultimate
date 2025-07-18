#!/usr/bin/env tsx
/**
 * Verify complete 2021 season data collection
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify2021Collection() {
  console.log(chalk.blue.bold('🏆 2021 SEASON DATA COLLECTION VERIFICATION\n'));

  const results: any = {};

  // Check games by sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .eq('metadata->>season', '2021');
      
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    // Count stats for each sport
    const { count: statsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>sport', sport)
      .gte('game_date', '2021-01-01')
      .lte('game_date', '2022-12-31');
      
    results[sport] = {
      games: gameCount || 0,
      players: playerCount || 0,
      stats: statsCount || 0
    };
  }

  // Display results
  console.log(chalk.green('✅ NFL 2021 Season:'));
  console.log(`   Games: ${results.NFL.games}`);
  console.log(`   Players: ${results.NFL.players}`);
  console.log(`   Stats: ${results.NFL.stats}`);
  
  console.log(chalk.blue('\n✅ NBA 2021-22 Season:'));
  console.log(`   Games: ${results.NBA.games}`);
  console.log(`   Players: ${results.NBA.players}`);
  console.log(`   Stats: ${results.NBA.stats}`);
  
  console.log(chalk.red('\n✅ MLB 2021 Season:'));
  console.log(`   Games: ${results.MLB.games}`);
  console.log(`   Players: ${results.MLB.players}`);
  console.log(`   Stats: ${results.MLB.stats}`);
  
  console.log(chalk.cyan('\n✅ NHL 2021-22 Season:'));
  console.log(`   Games: ${results.NHL.games}`);
  console.log(`   Players: ${results.NHL.players}`);
  console.log(`   Stats: ${results.NHL.stats}`);
  
  // Calculate totals
  const totals = {
    games: results.NFL.games + results.NBA.games + results.MLB.games + results.NHL.games,
    players: results.NFL.players + results.NBA.players + results.MLB.players + results.NHL.players,
    stats: results.NFL.stats + results.NBA.stats + results.MLB.stats + results.NHL.stats
  };
  
  console.log(chalk.yellow.bold('\n📊 GRAND TOTALS FOR 2021:'));
  console.log(chalk.yellow(`   Total Games: ${totals.games.toLocaleString()}`));
  console.log(chalk.yellow(`   Total Players: ${totals.players.toLocaleString()}`));
  console.log(chalk.yellow(`   Total Stats: ${totals.stats.toLocaleString()}`));
  
  // Check for ML enrichment data
  console.log(chalk.magenta('\n🌟 ML ENRICHMENT DATA:'));
  
  const { count: weatherCount } = await supabase
    .from('weather_data')
    .select('*', { count: 'exact', head: true });
    
  const { count: bettingCount } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true });
    
  const { count: injuryCount } = await supabase
    .from('player_injuries')
    .select('*', { count: 'exact', head: true });
    
  console.log(`   Weather Records: ${weatherCount || 0}`);
  console.log(`   Betting Lines: ${bettingCount || 0}`);
  console.log(`   Injury Records: ${injuryCount || 0}`);
  
  if ((weatherCount || 0) + (bettingCount || 0) + (injuryCount || 0) === 0) {
    console.log(chalk.red('\n⚠️  No ML enrichment data collected yet'));
  }
}

verify2021Collection().catch(console.error);