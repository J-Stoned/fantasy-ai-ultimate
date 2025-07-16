#!/usr/bin/env tsx
/**
 * 🔍 Find games missing stats - Final push to 100%!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMissingStats() {
  console.log(chalk.bold.yellow('🔍 FINDING GAMES WITHOUT STATS\n'));
  
  const sports = ['nba', 'nfl', 'nhl', 'mlb'];
  const missingBySport: Record<string, any[]> = {};
  let totalMissing = 0;
  
  for (const sport of sports) {
    console.log(chalk.cyan(`Checking ${sport.toUpperCase()}...`));
    
    // Get all completed games
    const { data: allGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport_id', sport)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false });
    
    if (!allGames || allGames.length === 0) continue;
    
    // Get games with stats
    const gameIds = allGames.map(g => g.id);
    const { data: gamesWithStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', gameIds);
    
    const hasStats = new Set(gamesWithStats?.map(g => g.game_id) || []);
    const missing = allGames.filter(g => !hasStats.has(g.id));
    
    missingBySport[sport] = missing;
    totalMissing += missing.length;
    
    console.log(`  Total games: ${allGames.length}`);
    console.log(`  With stats: ${hasStats.size}`);
    console.log(`  Missing: ${chalk.red(missing.length)}`);
    
    // Show sample of missing games
    if (missing.length > 0) {
      console.log('  Sample missing:');
      missing.slice(0, 3).forEach(g => {
        console.log(`    - ${g.external_id} (${new Date(g.start_time).toLocaleDateString()})`);
      });
    }
    console.log('');
  }
  
  console.log(chalk.bold.yellow('📊 SUMMARY'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Total games missing stats: ${chalk.red(totalMissing)}`);
  console.log(`Estimated missing player stats: ${chalk.red(totalMissing * 25)}`);
  
  // Save missing games to file for targeted collection
  const fs = require('fs');
  const missingGames = Object.entries(missingBySport).flatMap(([sport, games]) => 
    games.map(g => ({ ...g, sport }))
  );
  
  fs.writeFileSync(
    'missing-games.json',
    JSON.stringify(missingGames, null, 2)
  );
  
  console.log(`\n💾 Saved ${totalMissing} missing games to missing-games.json`);
  
  // Group by date to see patterns
  console.log(chalk.bold.yellow('\n📅 MISSING BY DATE'));
  const byDate: Record<string, number> = {};
  missingGames.forEach(g => {
    const date = new Date(g.start_time).toLocaleDateString();
    byDate[date] = (byDate[date] || 0) + 1;
  });
  
  Object.entries(byDate)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} games`);
    });
}

findMissingStats().catch(console.error);