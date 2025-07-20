#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatsPerGame() {
  console.log(chalk.bold.cyan('📊 STATS PER GAME BREAKDOWN\n'));
  
  const sports = ['NHL', 'NBA', 'MLB'];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`${sport} Analysis:`));
    
    // Get a sample game with stats
    const { data: sampleStats } = await supabase
      .from('player_game_logs')
      .select('game_id, player_id, stats, metadata')
      .eq('metadata->>sport', sport)
      .limit(1);
      
    if (!sampleStats || sampleStats.length === 0) {
      console.log(chalk.gray('  No stats found\n'));
      continue;
    }
    
    const sampleGameId = sampleStats[0].game_id;
    
    // Count stats for this specific game
    const { count: gameStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', sampleGameId)
      .eq('metadata->>sport', sport);
      
    console.log(chalk.green(`  Sample game ID: ${sampleGameId}`));
    console.log(chalk.green(`  Stats for this game: ${gameStats}`));
    
    // Break down by stat groups if available
    const { data: statGroups } = await supabase
      .from('player_game_logs')
      .select('metadata')
      .eq('game_id', sampleGameId)
      .eq('metadata->>sport', sport);
      
    const groupCounts = new Map();
    statGroups?.forEach(s => {
      const group = (s.metadata as any)?.stat_group || 'unknown';
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    });
    
    console.log(chalk.gray('  Breakdown by stat group:'));
    for (const [group, count] of groupCounts) {
      console.log(chalk.gray(`    ${group}: ${count} stats`));
    }
    
    // Calculate average
    const { count: totalStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>sport', sport);
      
    const { data: uniqueGames } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .eq('metadata->>sport', sport);
      
    const gameCount = new Set(uniqueGames?.map(s => s.game_id)).size;
    const avgStatsPerGame = gameCount > 0 ? Math.round((totalStats || 0) / gameCount) : 0;
    
    console.log(chalk.cyan(`  Average: ${avgStatsPerGame} stats per game\n`));
  }
  
  console.log(chalk.bold.yellow('Expected stats per game:'));
  console.log(chalk.gray('NHL: ~38 players (12F + 6D + 1G per team × 2 teams) = ~38 stats'));
  console.log(chalk.gray('NBA: ~26 players (13 active players per team × 2 teams) = ~26 stats'));
  console.log(chalk.gray('MLB: ~36 players (18 players per team × 2 teams) = ~36 stats'));
  console.log(chalk.gray(''));
  console.log(chalk.yellow('Our averages are much higher, suggesting we may be:'));
  console.log(chalk.gray('1. Collecting multiple stat records per player (different stat groups)'));
  console.log(chalk.gray('2. Including bench/inactive players'));
  console.log(chalk.gray('3. Having data quality issues with duplicates'));
}

analyzeStatsPerGame()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });