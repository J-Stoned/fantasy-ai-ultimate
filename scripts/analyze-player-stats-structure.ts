#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStructure() {
  console.log(chalk.bold.cyan('🔍 ANALYZING PLAYER STATS STRUCTURE...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Get sample stats
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(20);
    
  if (!stats || stats.length === 0) {
    console.log(chalk.red('No player stats found!'));
    return;
  }
  
  // Group by stat_type
  const statTypes: Record<string, any[]> = {};
  stats.forEach(stat => {
    const type = stat.stat_type || 'unknown';
    if (!statTypes[type]) statTypes[type] = [];
    statTypes[type].push(stat);
  });
  
  console.log(chalk.cyan('\n📊 STAT TYPES FOUND:'));
  Object.entries(statTypes).forEach(([type, examples]) => {
    console.log(chalk.white(`\n${type}: ${examples.length} examples`));
    console.log(chalk.gray('Sample values:'));
    examples.slice(0, 3).forEach(ex => {
      console.log(chalk.gray(`  - Value: ${ex.stat_value}, Fantasy: ${ex.fantasy_points}`));
    });
  });
  
  // Check if we have any actual game stats
  const { data: gameStats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('stat_type', 'points')
    .limit(10);
    
  console.log(chalk.cyan('\n🏀 CHECKING FOR COMMON STAT TYPES:'));
  const commonStats = ['points', 'assists', 'rebounds', 'steals', 'blocks', 'minutes'];
  for (const statType of commonStats) {
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('stat_type', statType);
      
    console.log(chalk.white(`${statType}: ${count || 0} records`));
  }
  
  // Get a game with full stats
  const { data: gamesWithMostStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
    
  const gameCounts: Record<number, number> = {};
  gamesWithMostStats?.forEach(s => {
    if (s.game_id) {
      gameCounts[s.game_id] = (gameCounts[s.game_id] || 0) + 1;
    }
  });
  
  const sortedGames = Object.entries(gameCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
    
  console.log(chalk.cyan('\n🎮 GAMES WITH MOST STATS:'));
  for (const [gameId, count] of sortedGames) {
    const { data: gameInfo } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
      .eq('id', gameId)
      .single();
      
    if (gameInfo) {
      console.log(chalk.white(`Game ${gameId}: ${gameInfo.away_team?.name} @ ${gameInfo.home_team?.name} - ${count} stats`));
    }
  }
}

analyzeStructure().catch(console.error);