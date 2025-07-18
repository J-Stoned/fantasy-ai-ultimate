#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDetailed2021() {
  console.log(chalk.cyan('\n📊 DETAILED 2021 DATA CHECK\n'));

  // Get 2021 games by checking metadata
  const { data: games2021, count } = await supabase
    .from('games')
    .select('id, sport, home_score, away_score', { count: 'exact' })
    .eq('metadata->>season', '2021');

  console.log(chalk.yellow(`Total 2021 games: ${count}`));
  
  // Group by sport
  const bySport = games2021?.reduce((acc, game) => {
    acc[game.sport] = (acc[game.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log(chalk.yellow('\nGames by sport:'));
  Object.entries(bySport).forEach(([sport, cnt]) => {
    console.log(`  ${sport}: ${cnt}`);
  });

  // Check enrichment for these specific games
  const gameIds = games2021?.map(g => g.id) || [];
  
  const { count: betCount } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  const { count: weatherCount } = await supabase
    .from('weather_data')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  const { count: metricsCount } = await supabase
    .from('advanced_player_metrics')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  console.log(chalk.yellow('\nEnrichment coverage:'));
  console.log(`  Betting lines: ${betCount}/${count} (${((betCount || 0) / (count || 1) * 100).toFixed(1)}%)`);
  console.log(`  Weather data: ${weatherCount} records`);
  console.log(`  Advanced metrics: ${metricsCount} records`);
  console.log(`  Player stats: ${statsCount} records`);

  // Check for specific 2021 NFL games
  const { data: nfl2021 } = await supabase
    .from('games')
    .select('id, sport, start_time')
    .eq('sport', 'NFL')
    .eq('metadata->>season', '2021')
    .limit(5);

  console.log(chalk.yellow('\nSample NFL 2021 games:'));
  nfl2021?.forEach(game => {
    console.log(`  Game ${game.id}: ${game.start_time}`);
  });
}

checkDetailed2021().catch(console.error);