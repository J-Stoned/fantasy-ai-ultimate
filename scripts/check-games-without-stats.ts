#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function findGamesWithoutStats() {
  console.log(chalk.bold.yellow('🔍 Finding games without player stats...'));
  
  // Get games from 2024 or earlier that need stats
  const { data: games } = await enhancedDb.getClient()
    .from('games')
    .select('id, external_id, sport, start_time, home_team_id, away_team_id')
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .lt('start_time', '2025-01-01')
    .order('start_time', { ascending: false })
    .limit(200);

  if (!games || games.length === 0) {
    console.log('No games found');
    return;
  }

  // Check which have stats
  const gameIds = games.map(g => g.id);
  const { data: statsData } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds);

  const gamesWithStats = new Set(statsData?.map(s => s.game_id) || []);
  const gamesWithoutStats = games.filter(g => !gamesWithStats.has(g.id));

  console.log(chalk.green(`\nFound ${gamesWithoutStats.length} games from 2024 or earlier without stats:`));
  
  // Group by sport
  const bySport: Record<string, any[]> = {};
  gamesWithoutStats.forEach(g => {
    if (!bySport[g.sport]) bySport[g.sport] = [];
    bySport[g.sport].push(g);
  });

  Object.entries(bySport).forEach(([sport, games]) => {
    console.log(chalk.cyan(`\n${sport}: ${games.length} games`));
    games.slice(0, 5).forEach(g => {
      console.log(`  - Game ${g.id}: ${g.external_id} (${new Date(g.start_time).toLocaleDateString()})`);
    });
    if (games.length > 5) {
      console.log(`  ... and ${games.length - 5} more`);
    }
  });

  return gamesWithoutStats;
}

findGamesWithoutStats().catch(console.error);