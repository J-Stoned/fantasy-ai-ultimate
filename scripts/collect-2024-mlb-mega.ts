#!/usr/bin/env tsx
/**
 * ⚾ MLB 2024 MEGA COLLECTOR - Fill the 2,300+ game gap
 * 
 * Current: 117 games
 * Target: ~2,430 games
 * Need: 2,300+ games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import the working collector class
import { CollectorClass } from './collect-all-2023-seasons-FINAL.js';

class MLB2024Collector extends CollectorClass {
  constructor() {
    super();
  }
  
  async run() {
    console.log(chalk.bold.red('\\n⚾ MLB 2024 MEGA COLLECTOR\\n'));
    console.log('Current: 117 games in database');
    console.log('Target: ~2,430 games');
    console.log(chalk.yellow('Collecting 2,300+ missing games...\\n'));
    
    // MLB 2024 season: March 28 - October 31
    const seasons = [{
      sport: 'mlb',
      startDate: '2024-03-28',
      endDate: '2024-10-31',
      expectedGames: 2430
    }];
    
    // Load caches
    await this.loadCaches();
    
    // Process MLB 2024
    for (const season of seasons) {
      console.log(chalk.bold.blue(`\\n📊 COLLECTING ${season.sport.toUpperCase()} ${season.startDate.split('-')[0]} SEASON`));
      console.log(`Date range: ${season.startDate} to ${season.endDate}`);
      
      const games = await this.fetchSeasonGames(season.sport, season.startDate, season.endDate);
      console.log(chalk.green(`\\n✅ Collected ${games.length} ${season.sport.toUpperCase()} games`));
      
      // Collect stats for all games
      await this.collectPlayerStats(games, season.sport);
    }
    
    // Final summary
    console.log(chalk.bold.green('\\n✅ MLB 2024 COLLECTION COMPLETE!'));
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    console.log(`Total player logs in database: ${count?.toLocaleString()}`);
  }
}

// Run collector
const collector = new MLB2024Collector();
collector.run().catch(console.error);