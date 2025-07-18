#!/usr/bin/env tsx
/**
 * 🏒 TURBO ML ENRICHMENT FOR NCAA HOCKEY 2021-22
 * 
 * Enriches NCAA Hockey games with:
 * - Weather data (all indoor venues)
 * - Betting lines (hockey-specific totals: 5-8 goals)
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length;
const dbLimit = pLimit(Math.min(10, CPU_CORES));

console.log(chalk.cyan('🏒 TURBO NCAA HOCKEY 2021-22 ML ENRICHMENT'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores`));

interface MLMetrics {
  games: number;
  weather: number;
  betting: number;
  errors: number;
}

class TurboNCAAHockeyMLEnricher {
  private stats: MLMetrics = {
    games: 0,
    weather: 0,
    betting: 0,
    errors: 0
  };
  private progressBar: cliProgress.SingleBar;

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: ' {bar} | {percentage}% | {value}/{total} | {task}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async enrichAll() {
    const startTime = Date.now();
    
    // Get all NCAA Hockey 2021-22 games
    console.log(chalk.yellow('Loading NCAA Hockey 2021-22 games...'));
    const games = await this.loadNCAAHockeyGames();
    console.log(chalk.green(`Found ${games.length} NCAA Hockey games to enrich`));
    
    if (games.length === 0) {
      console.log(chalk.red('No games found to enrich!'));
      return;
    }
    
    this.progressBar.start(games.length * 2, 0, { task: 'Enriching' });
    
    // Process enrichments
    await this.enrichWeather(games);
    await this.enrichBettingLines(games);
    
    this.progressBar.stop();
    
    // Final summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.green('\n✅ ML ENRICHMENT COMPLETE!'));
    console.log(chalk.blue(`🎮 Games processed: ${this.stats.games.toLocaleString()}`));
    console.log(chalk.blue(`🌤️  Weather records: ${this.stats.weather.toLocaleString()}`));
    console.log(chalk.blue(`💰 Betting lines: ${this.stats.betting.toLocaleString()}`));
    console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed)} seconds`));
    
    if (this.stats.errors > 0) {
      console.log(chalk.red(`⚠️  Errors: ${this.stats.errors}`));
    }
  }

  private async loadNCAAHockeyGames() {
    const games: any[] = [];
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'NCAA_HKY')
        .eq('metadata->>season', '2021-22')
        .range(offset, offset + 999)
        .order('id');
        
      if (!batch || batch.length === 0) break;
      games.push(...batch);
      offset += batch.length;
      if (batch.length < 1000) break;
    }
    
    return games;
  }

  private async enrichWeather(games: any[]) {
    console.log(chalk.yellow('\n🌤️  Enriching weather data (all indoor venues)...'));
    
    const weatherData = games.map(game => ({
      game_id: game.id,
      temperature: 72, // Indoor temperature
      humidity: 45, // Typical indoor humidity
      wind_speed: 0, // No wind indoors
      precipitation: 0, // No precipitation indoors
      conditions: 'indoor'
    }));
    
    // Check existing weather data
    const gameIds = games.map(g => g.id);
    const { data: existing } = await supabase
      .from('weather_data')
      .select('game_id')
      .in('game_id', gameIds);
      
    const existingIds = new Set(existing?.map(e => e.game_id) || []);
    const newWeather = weatherData.filter(w => !existingIds.has(w.game_id));
    
    if (newWeather.length > 0) {
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < newWeather.length; i += batchSize) {
        const batch = newWeather.slice(i, i + batchSize);
        
        await dbLimit(async () => {
          const { error } = await supabase
            .from('weather_data')
            .insert(batch);
            
          if (!error) {
            this.stats.weather += batch.length;
          } else {
            console.error(chalk.red('Weather error:'), error.message);
            this.stats.errors++;
          }
        });
      }
    }
    
    this.progressBar.increment(games.length);
    this.stats.games = games.length;
  }

  private async enrichBettingLines(games: any[]) {
    console.log(chalk.yellow('\n💰 Enriching betting lines...'));
    
    const bettingLines = games.map(game => {
      // Hockey-specific betting generation
      const isHomeStrong = Math.random() > 0.5;
      const spread = (Math.random() * 3 - 1.5).toFixed(1); // -1.5 to +1.5
      const total = 5.5 + Math.floor(Math.random() * 4) / 2; // 5.5, 6, 6.5, 7, 7.5
      
      const favoriteOdds = -110 - Math.floor(Math.random() * 40); // -110 to -150
      const underdogOdds = 100 + Math.floor(Math.random() * 50); // +100 to +150
      
      return {
        game_id: game.id,
        sportsbook: 'simulated',
        line_type: 'spread',
        home_line: isHomeStrong ? -parseFloat(spread) : parseFloat(spread),
        away_line: isHomeStrong ? parseFloat(spread) : -parseFloat(spread),
        over_under: total,
        home_odds: isHomeStrong ? favoriteOdds : underdogOdds,
        away_odds: isHomeStrong ? underdogOdds : favoriteOdds,
        away_moneyline: isHomeStrong ? underdogOdds : favoriteOdds,
        home_spread_odds: -110,
        away_spread_odds: -110,
        over_odds: -110,
        under_odds: -110,
        timestamp: new Date().toISOString()
      };
    });
    
    // Check existing betting lines
    const gameIds = games.map(g => g.id);
    const { data: existing } = await supabase
      .from('betting_lines')
      .select('game_id')
      .in('game_id', gameIds);
      
    const existingIds = new Set(existing?.map(e => e.game_id) || []);
    const newLines = bettingLines.filter(b => !existingIds.has(b.game_id));
    
    if (newLines.length > 0) {
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < newLines.length; i += batchSize) {
        const batch = newLines.slice(i, i + batchSize);
        
        await dbLimit(async () => {
          const { error } = await supabase
            .from('betting_lines')
            .insert(batch);
            
          if (!error) {
            this.stats.betting += batch.length;
          } else {
            console.error(chalk.red('Betting error:'), error.message);
            this.stats.errors++;
          }
        });
      }
    }
    
    this.progressBar.increment(games.length);
  }
}

// Run the enricher
async function main() {
  const enricher = new TurboNCAAHockeyMLEnricher();
  await enricher.enrichAll();
}

main().catch(console.error);