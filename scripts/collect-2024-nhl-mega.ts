#!/usr/bin/env tsx
/**
 * 🏒 NHL 2024 MEGA COLLECTOR - Fill the gap
 * 
 * Current: ~600 games (only partial data)
 * Target: ~1,300+ games for full 2023-24 season
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import the working collector class
const { CollectorClass } = await import('./collect-all-2023-seasons-FINAL.js');

class NHL2024Collector extends CollectorClass {
  constructor() {
    super();
  }
  
  async run() {
    console.log(chalk.bold.cyan('\\n🏒 NHL 2023-24 SEASON COLLECTOR\\n'));
    
    // NHL 2023-24 season: October 10, 2023 - June 24, 2024
    const seasons = [{
      sport: 'nhl',
      startDate: '2023-10-10',
      endDate: '2024-06-24',
      expectedGames: 1392  // 82 games × 32 teams ÷ 2 + playoffs
    }];
    
    // Check current status
    const { count: currentGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nhl')
      .gte('start_time', '2023-10-01')
      .lt('start_time', '2024-07-01');
    
    console.log(`Current NHL 2023-24 games: ${currentGames || 0}`);
    console.log(`Target: ${seasons[0].expectedGames} games`);
    console.log(chalk.yellow(`Need to collect: ~${seasons[0].expectedGames - (currentGames || 0)} more games\\n`));
    
    // Load caches
    await this.loadCaches();
    
    // Process NHL 2023-24
    for (const season of seasons) {
      console.log(chalk.bold.blue(`\\n📊 COLLECTING ${season.sport.toUpperCase()} ${season.startDate.split('-')[0]}-${season.endDate.split('-')[0]} SEASON`));
      console.log(`Date range: ${season.startDate} to ${season.endDate}`);
      
      const games = await this.fetchSeasonGames(season.sport, season.startDate, season.endDate);
      console.log(chalk.green(`\\n✅ Collected ${games.length} ${season.sport.toUpperCase()} games`));
      
      // Collect stats for all games
      await this.collectPlayerStats(games, season.sport);
    }
    
    // Final summary
    console.log(chalk.bold.green('\\n✅ NHL 2023-24 COLLECTION COMPLETE!'));
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    console.log(`Total player logs in database: ${count?.toLocaleString()}`);
  }
}

// Run collector
const collector = new NHL2024Collector();
collector.run().catch(console.error);