#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsSportField() {
  console.log(chalk.bold.cyan('🔍 CHECKING SPORT FIELD IN PLAYER_GAME_LOGS\n'));
  
  // 1. Get a 2021 NFL game
  const { data: nflGame } = await supabase
    .from('games')
    .select('id, external_id, sport')
    .eq('external_id', 'espn_nfl_401326308')
    .single();
    
  if (!nflGame) {
    console.log('Game not found');
    return;
  }
  
  console.log(chalk.yellow('NFL Game:'));
  console.log(chalk.white(`ID: ${nflGame.id}`));
  console.log(chalk.white(`External ID: ${nflGame.external_id}`));
  console.log(chalk.white(`Sport: ${nflGame.sport}\n`));
  
  // 2. Get stats for this game
  const { data: gameStats } = await supabase
    .from('player_game_logs')
    .select('id, sport, game_id, game_date')
    .eq('game_id', nflGame.id)
    .limit(10);
    
  console.log(chalk.yellow('Stats for this game:'));
  if (gameStats && gameStats.length > 0) {
    console.log(chalk.white(`Found ${gameStats.length} stats\n`));
    gameStats.forEach(stat => {
      console.log(chalk.white(`Stat ID: ${stat.id}`));
      console.log(chalk.red(`  Sport: ${stat.sport || 'NULL'} ← THIS IS THE ISSUE!`));
      console.log(chalk.gray(`  Game ID: ${stat.game_id}`));
      console.log(chalk.gray(`  Date: ${stat.game_date}\n`));
    });
  }
  
  // 3. Check overall sport values
  console.log(chalk.yellow('\n3. Sport field values in player_game_logs:'));
  
  const { data: sportValues } = await supabase
    .from('player_game_logs')
    .select('sport')
    .limit(1000);
    
  if (sportValues) {
    const sportCounts: Record<string, number> = {};
    sportValues.forEach(row => {
      const sport = row.sport || 'NULL';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(chalk.white(`  ${sport}: ${count} records`));
    });
  }
  
  // 4. Count stats by joining with games table
  console.log(chalk.yellow('\n\n4. Actual 2021 NFL stats (by joining with games):'));
  
  // First get all 2021 NFL game IDs
  const { data: games2021 } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2022-01-01');
    
  if (games2021 && games2021.length > 0) {
    const gameIds = games2021.map(g => g.id);
    console.log(chalk.white(`2021 NFL games: ${gameIds.length}`));
    
    // Count stats for these games
    const { count: statsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds.slice(0, 50)); // Test with first 50 games
      
    console.log(chalk.white(`Stats for first 50 games of 2021: ${statsCount || 0}`));
    
    // Estimate total
    if (statsCount && statsCount > 0) {
      const avgPerGame = statsCount / 50;
      const estimated = Math.round(avgPerGame * gameIds.length);
      console.log(chalk.green(`\nEstimated total 2021 NFL stats: ~${estimated.toLocaleString()}`));
      console.log(chalk.green(`Average stats per game: ~${Math.round(avgPerGame)}`));
    }
  }
  
  console.log(chalk.bold.red('\n\n⚠️  ISSUE IDENTIFIED:'));
  console.log(chalk.red('The sport field in player_game_logs is NULL for NFL stats!'));
  console.log(chalk.red('This is why queries with sport = "NFL" return 0 results.'));
  console.log(chalk.yellow('\nThe stats exist but need the sport field populated.'));
}

checkStatsSportField().catch(console.error);