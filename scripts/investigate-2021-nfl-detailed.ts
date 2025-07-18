#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate2021NFLData() {
  console.log(chalk.bold.cyan('🔍 INVESTIGATING 2021 NFL DATA STATUS\n'));
  
  // 1. Check all 2021 NFL games
  console.log(chalk.bold.yellow('1. 2021 NFL GAMES:'));
  console.log(chalk.gray('='.repeat(50)));
  
  const { data: games2021, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2022-01-01')
    .order('start_time');
    
  if (gamesError) {
    console.error('Error fetching games:', gamesError);
    return;
  }
  
  console.log(chalk.white(`Total 2021 games: ${games2021?.length || 0}`));
  
  // Group by month
  const gamesByMonth: Record<string, number> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  games2021?.forEach(game => {
    const date = new Date(game.start_time);
    const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    gamesByMonth[monthKey] = (gamesByMonth[monthKey] || 0) + 1;
  });
  
  console.log(chalk.white('\nGames by month:'));
  Object.entries(gamesByMonth).forEach(([month, count]) => {
    console.log(chalk.white(`  ${month}: ${count} games`));
  });
  
  // 2. Check for stats in player_game_logs
  console.log(chalk.bold.yellow('\n2. 2021 NFL PLAYER STATS:'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Get game IDs
  const gameIds = games2021?.map(g => g.id) || [];
  
  if (gameIds.length > 0) {
    // Check stats for these games
    const { data: statsCount, error: statsError } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds);
      
    console.log(chalk.white(`Stats for 2021 games: ${statsCount || 0}`));
    
    // Check a sample of games to see which have stats
    console.log(chalk.white('\nChecking first 10 games for stats:'));
    
    for (const game of games2021.slice(0, 10)) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
        
      const date = new Date(game.start_time).toLocaleDateString();
      const hasStats = count && count > 0;
      console.log(chalk.white(`  ${game.external_id} (${date}): ${hasStats ? chalk.green(`✅ ${count} stats`) : chalk.red('❌ No stats')}`));
    }
  }
  
  // 3. Check date range of actual stats
  console.log(chalk.bold.yellow('\n3. ACTUAL NFL STATS DATE RANGE:'));
  console.log(chalk.gray('='.repeat(50)));
  
  const { data: statsDateRange } = await supabase
    .from('player_game_logs')
    .select('game_date')
    .eq('sport', 'NFL')
    .gte('game_date', '2021-01-01')
    .lt('game_date', '2022-01-01')
    .order('game_date')
    .limit(1000);
    
  if (statsDateRange && statsDateRange.length > 0) {
    const dates = statsDateRange.map(s => new Date(s.game_date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    console.log(chalk.white(`First stat: ${minDate.toLocaleDateString()}`));
    console.log(chalk.white(`Last stat: ${maxDate.toLocaleDateString()}`));
    console.log(chalk.white(`Total 2021 stats found: ${statsDateRange.length}`));
    
    // Group stats by month
    const statsByMonth: Record<string, number> = {};
    statsDateRange.forEach(stat => {
      const date = new Date(stat.game_date);
      const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      statsByMonth[monthKey] = (statsByMonth[monthKey] || 0) + 1;
    });
    
    console.log(chalk.white('\nStats by month:'));
    Object.entries(statsByMonth).forEach(([month, count]) => {
      console.log(chalk.white(`  ${month}: ${count} stats`));
    });
  } else {
    console.log(chalk.red('No 2021 NFL stats found in player_game_logs'));
  }
  
  // 4. Check ML enrichment data
  console.log(chalk.bold.yellow('\n4. ML ENRICHMENT DATA FOR 2021:'));
  console.log(chalk.gray('='.repeat(50)));
  
  if (gameIds.length > 0) {
    const { count: weatherCount } = await supabase
      .from('weather_data')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);
      
    const { count: bettingCount } = await supabase
      .from('betting_lines')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);
      
    console.log(chalk.white(`Weather data: ${weatherCount || 0} records`));
    console.log(chalk.white(`Betting lines: ${bettingCount || 0} records`));
  }
  
  // 5. Final verdict
  console.log(chalk.bold.cyan('\n\nFINAL VERDICT:'));
  console.log(chalk.gray('='.repeat(50)));
  
  const hasGames = games2021 && games2021.length > 0;
  const hasFullSeason = gamesByMonth['Sep 2021'] && gamesByMonth['Oct 2021'] && 
                       gamesByMonth['Nov 2021'] && gamesByMonth['Dec 2021'] &&
                       (gamesByMonth['Jan 2022'] || gamesByMonth['Feb 2022']);
  
  if (hasGames && hasFullSeason) {
    console.log(chalk.green('✅ Full 2021 NFL season games are in database'));
    console.log(chalk.white(`   Total: ${games2021.length} games from Sep 2021 to Jan/Feb 2022`));
  } else if (hasGames) {
    console.log(chalk.yellow('⚠️  Partial 2021 NFL season in database'));
    console.log(chalk.white(`   Only ${games2021.length} games found`));
  } else {
    console.log(chalk.red('❌ No 2021 NFL games found'));
  }
  
  console.log(chalk.red('\n❌ NO STATS collected for 2021 NFL games'));
  console.log(chalk.white('   All games exist but player_game_logs is empty for 2021'));
}

investigate2021NFLData().catch(console.error);