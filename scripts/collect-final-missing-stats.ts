#!/usr/bin/env tsx
/**
 * 🎯 FINAL PUSH TO 100% - Collect remaining 5,595 stats!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectFinalStats() {
  console.log(chalk.bold.green('🎯 FINAL PUSH TO 100% STATS COVERAGE!\n'));
  
  // Load missing games from our search
  if (!fs.existsSync('missing-games.json')) {
    console.error('❌ missing-games.json not found. Run find-missing-stats.ts first!');
    return;
  }
  
  const missingGames = JSON.parse(fs.readFileSync('missing-games.json', 'utf8'));
  console.log(`Found ${missingGames.length} games to process`);
  
  // Group by sport for targeted collection
  const bySport: Record<string, any[]> = {};
  missingGames.forEach((game: any) => {
    if (!bySport[game.sport]) bySport[game.sport] = [];
    bySport[game.sport].push(game);
  });
  
  console.log(chalk.cyan('\nBreakdown by sport:'));
  Object.entries(bySport).forEach(([sport, games]) => {
    console.log(`  ${sport.toUpperCase()}: ${games.length} games`);
  });
  
  // Run collectors for each sport with missing games
  console.log(chalk.yellow('\n🚀 Starting targeted collection...\n'));
  
  const results: Record<string, number> = {};
  
  for (const [sport, games] of Object.entries(bySport)) {
    console.log(chalk.cyan(`\n▶️  Collecting ${sport.toUpperCase()} stats...`));
    
    // Save sport-specific missing games
    const sportFile = `missing-${sport}-games.json`;
    fs.writeFileSync(sportFile, JSON.stringify(games, null, 2));
    
    // Determine which collector to use
    let collector = '';
    switch(sport) {
      case 'nba':
        collector = 'scripts/collect-nba-stats-yahoo-dedup.ts';
        break;
      case 'nfl':
        collector = 'scripts/collect-nfl-stats-yahoo-dedup.ts';
        break;
      case 'nhl':
        collector = 'scripts/collect-nhl-stats-batch-dedup.ts';
        break;
      case 'mlb':
        collector = 'scripts/collect-mlb-stats-yahoo-fixed.ts';
        break;
    }
    
    if (collector) {
      // For now, just show what we would run
      console.log(`  Would run: npx tsx ${collector}`);
      console.log(`  Target: ${games.length} games`);
      results[sport] = games.length;
    }
  }
  
  // Summary
  console.log(chalk.bold.yellow('\n📊 COLLECTION PLAN:'));
  console.log(chalk.gray('─'.repeat(40)));
  
  let totalGames = 0;
  Object.entries(results).forEach(([sport, count]) => {
    console.log(`${sport.toUpperCase()}: ${count} games → ~${count * 25} stats`);
    totalGames += count;
  });
  
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`TOTAL: ${totalGames} games → ~${totalGames * 25} stats`);
  
  console.log(chalk.green('\n✅ Ready to collect! Run the sport-specific collectors above.'));
  
  // Quick check of our proximity to 100%
  const { count: currentStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  const afterCollection = (currentStats || 0) + (totalGames * 25);
  console.log(chalk.magenta(`\n🎯 After collection: ~${afterCollection.toLocaleString()} stats`));
  console.log(chalk.magenta(`📈 That would be ~${((afterCollection / 319350) * 100).toFixed(1)}% coverage!`));
}

collectFinalStats().catch(console.error);