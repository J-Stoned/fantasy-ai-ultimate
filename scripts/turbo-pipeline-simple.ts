#!/usr/bin/env tsx
/**
 * 🚀 TURBO HISTORICAL PIPELINE - SIMPLIFIED VERSION
 * 
 * Uses promise-based parallelism instead of worker threads
 * Still achieves 12x parallelism using p-limit
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { InMemoryCache } from './utils/memory-cache';
import { StatsBuffer, BufferedStat } from './utils/stats-buffer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Limit concurrent API calls
const limit = pLimit(12); // 12 concurrent requests

// ESPN API mappings
const ESPN_SPORTS: Record<string, string> = {
  'NFL': 'football/nfl',
  'NBA': 'basketball/nba',
  'MLB': 'baseball/mlb',
  'NHL': 'hockey/nhl'
};

// Stat mappings for each sport
const STAT_MAPPINGS: Record<string, Record<string, string>> = {
  'NBA': {
    'MIN': 'minutes_played',
    'PTS': 'points',
    'REB': 'rebounds',
    'AST': 'assists',
    'STL': 'steals',
    'BLK': 'blocks',
    'TO': 'turnovers',
    'FGM': 'field_goals_made',
    'FGA': 'field_goals_attempted'
  },
  'NFL': {
    'PASSYDS': 'passing_yards',
    'PASSTD': 'passing_touchdowns',
    'INT': 'interceptions',
    'RUSHYDS': 'rushing_yards',
    'RUSHTD': 'rushing_touchdowns',
    'RECYDS': 'receiving_yards',
    'RECTD': 'receiving_touchdowns',
    'REC': 'receptions'
  },
  'MLB': {
    'AB': 'at_bats',
    'H': 'hits',
    'R': 'runs',
    'RBI': 'runs_batted_in',
    'HR': 'home_runs',
    'BB': 'walks',
    'SO': 'strikeouts'
  },
  'NHL': {
    'G': 'goals',
    'A': 'assists',
    'PTS': 'points',
    'SOG': 'shots_on_goal',
    'PIM': 'penalty_minutes'
  }
};

class TurboHistoricalPipeline {
  private cache!: InMemoryCache;
  private statsBuffer!: StatsBuffer;
  private progressBar: cliProgress.SingleBar;
  private collectedStats = 0;

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Speed: {speed} stats/sec | ETA: {eta_formatted}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);
  }

  async initialize() {
    console.log(chalk.bold.cyan('🚀 TURBO HISTORICAL PIPELINE INITIALIZING\n'));
    
    // Load entire database into memory
    console.log(chalk.yellow('Loading database into memory...'));
    this.cache = new InMemoryCache();
    await this.cache.initialize();
    
    console.log(chalk.green(`  ✅ Loaded ${this.cache.getStats().players} players`));
    console.log(chalk.green(`  ✅ Loaded ${this.cache.getStats().teams} teams`));
    console.log(chalk.green(`  ✅ Loaded ${this.cache.getStats().games} games\n`));
    
    // Pre-allocate stats buffer
    this.statsBuffer = new StatsBuffer(500000);
  }

  async collectAll() {
    const startTime = Date.now();
    
    // 1. Fix NFL stats (already have games)
    await this.collectStats('NFL', 2021);
    await this.collectStats('NFL', 2022);
    await this.flushStatsBuffer();
    
    // 2. Complete NBA (need 2021 games)
    await this.collectGames('NBA', 2021);
    await this.collectStats('NBA', 2021);
    await this.collectStats('NBA', 2022);
    await this.flushStatsBuffer();
    
    // 3. Collect MLB (largest dataset)
    await this.collectGames('MLB', 2021);
    await this.collectStats('MLB', 2021);
    await this.collectGames('MLB', 2022);
    await this.collectStats('MLB', 2022);
    await this.flushStatsBuffer();
    
    // 4. Collect NHL
    await this.collectGames('NHL', 2021);
    await this.collectStats('NHL', 2021);
    await this.collectGames('NHL', 2022);
    await this.collectStats('NHL', 2022);
    await this.flushStatsBuffer();
    
    const elapsed = (Date.now() - startTime) / 1000 / 60;
    console.log(chalk.bold.green(`\n✅ COLLECTION COMPLETE!`));
    console.log(chalk.white(`Total time: ${elapsed.toFixed(1)} minutes`));
    console.log(chalk.white(`Total stats: ${this.collectedStats.toLocaleString()}`));
  }

  private async collectGames(sport: string, year: number) {
    console.log(chalk.bold.yellow(`\n📅 Collecting ${sport} ${year} games...`));
    
    // Use existing universal collector
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const process = spawn('npx', [
        'tsx',
        'scripts/universal-sports-collector.ts',
        'games',
        sport.toLowerCase(),
        '--historical',
        '--year',
        year.toString(),
        '--enrich'
      ], {
        stdio: 'inherit',
        shell: true
      });
      
      process.on('close', resolve);
    });
  }

  private async collectStats(sport: string, year: number) {
    console.log(chalk.bold.yellow(`\n📊 Collecting ${sport} ${year} stats...`));
    
    // Reload cache to get newly added games
    await this.cache.initialize();
    
    const games = await this.cache.getGamesForSportYear(sport, year);
    if (!games.length) {
      console.log(chalk.red(`No games found for ${sport} ${year}`));
      return;
    }
    
    console.log(chalk.blue(`Found ${games.length} games to process`));
    
    // Setup progress bar
    const estimatedStats = games.length * this.estimateStatsPerGame(sport);
    this.progressBar.start(estimatedStats, 0, { speed: 0 });
    
    // Process games with concurrency limit
    const gamePromises = games.map(game => 
      limit(() => this.processGame(game, sport, year))
    );
    
    await Promise.all(gamePromises);
    this.progressBar.stop();
  }

  private async processGame(game: any, sport: string, year: number): Promise<void> {
    try {
      const espnGameId = game.external_id?.split('_').pop();
      if (!espnGameId) return;
      
      const url = `https://site.api.espn.com/apis/site/v2/sports/${ESPN_SPORTS[sport]}/summary?event=${espnGameId}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'Accept-Encoding': 'gzip, deflate' }
      });
      
      const gameData = response.data;
      let gameStats = 0;
      
      if (gameData.boxscore?.players) {
        for (const team of gameData.boxscore.players) {
          const teamId = team.team.id;
          const dbTeam = this.cache.getTeamByExternalId(`espn_${sport.toLowerCase()}_${teamId}`);
          
          if (!dbTeam) continue;
          
          const isHome = team.homeAway === 'home';
          const opponentTeamId = isHome ? game.away_team_id : game.home_team_id;
          
          for (const statGroup of team.statistics || []) {
            for (const athlete of statGroup.athletes || []) {
              const player = this.cache.getPlayerByExternalId(
                `espn_${sport.toLowerCase()}_${athlete.athlete.id}`
              );
              
              if (!player) continue;
              
              const transformedStats = this.transformStats(
                athlete.stats || [],
                statGroup.names || [],
                sport
              );
              
              if (Object.keys(transformedStats).length === 0) continue;
              
              const stat: BufferedStat = {
                player_id: player.id,
                game_id: game.id,
                team_id: dbTeam.id,
                opponent_id: opponentTeamId,
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                is_home: isHome,
                sport: sport,
                stats: transformedStats,
                fantasy_points: this.calculateFantasyPoints(transformedStats, sport),
                metadata: {
                  historical_season: year,
                  collection_source: 'turbo-pipeline'
                }
              };
              
              this.statsBuffer.add(stat);
              gameStats++;
              this.collectedStats++;
            }
          }
        }
      }
      
      this.progressBar.increment(gameStats);
      
    } catch (error: any) {
      console.error(chalk.red(`\nError processing game ${game.external_id}: ${error.message}`));
    }
  }

  private transformStats(
    statValues: any[],
    statNames: string[],
    sport: string
  ): Record<string, any> {
    const stats: Record<string, any> = {};
    const mapping = STAT_MAPPINGS[sport] || {};
    
    statNames.forEach((name, index) => {
      if (mapping[name] && statValues[index] !== undefined) {
        stats[mapping[name]] = statValues[index];
      }
    });
    
    return stats;
  }

  private calculateFantasyPoints(stats: any, sport: string): number {
    let points = 0;
    
    switch (sport) {
      case 'NBA':
        points = (stats.points || 0) + 
                 (stats.rebounds || 0) * 1.2 + 
                 (stats.assists || 0) * 1.5 + 
                 (stats.steals || 0) * 3 + 
                 (stats.blocks || 0) * 3 - 
                 (stats.turnovers || 0);
        break;
      case 'NFL':
        points = (stats.passing_yards || 0) / 25 + 
                 (stats.passing_touchdowns || 0) * 4 + 
                 (stats.rushing_yards || 0) / 10 + 
                 (stats.rushing_touchdowns || 0) * 6 + 
                 (stats.receiving_yards || 0) / 10 + 
                 (stats.receiving_touchdowns || 0) * 6 + 
                 (stats.receptions || 0) * 0.5;
        break;
      case 'MLB':
        points = (stats.hits || 0) * 3 + 
                 (stats.runs || 0) * 2 + 
                 (stats.runs_batted_in || 0) * 2 + 
                 (stats.home_runs || 0) * 4 + 
                 (stats.walks || 0) - 
                 (stats.strikeouts || 0) * 0.5;
        break;
      case 'NHL':
        points = (stats.goals || 0) * 3 + 
                 (stats.assists || 0) * 2 + 
                 (stats.shots_on_goal || 0) * 0.5;
        break;
    }
    
    return Math.max(0, points);
  }

  private estimateStatsPerGame(sport: string): number {
    const estimates: Record<string, number> = {
      'NFL': 80,
      'NBA': 30,
      'MLB': 50,
      'NHL': 40
    };
    return estimates[sport] || 40;
  }

  private async flushStatsBuffer() {
    const stats = this.statsBuffer.getAll();
    if (stats.length === 0) return;
    
    console.log(chalk.blue(`\nFlushing ${stats.length.toLocaleString()} stats to database...`));
    
    // Insert in batches of 10,000
    const batchSize = 10000;
    for (let i = 0; i < stats.length; i += batchSize) {
      const batch = stats.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { 
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true 
        });
        
      if (error) {
        console.error(chalk.red('Error inserting batch:', error));
      } else {
        console.log(chalk.green(`  ✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(stats.length/batchSize)}`));
      }
    }
    
    this.statsBuffer.clear();
  }
}

// Main execution
async function main() {
  const pipeline = new TurboHistoricalPipeline();
  
  try {
    await pipeline.initialize();
    await pipeline.collectAll();
    
    // 5. Run ML enrichment
    console.log(chalk.bold.cyan('\n🧠 Running ML enrichment...'));
    const { spawn } = await import('child_process');
    
    await new Promise((resolve) => {
      const process = spawn('npx', [
        'tsx',
        'scripts/ml-enrichment-pipeline.ts'
      ], {
        stdio: 'inherit',
        shell: true
      });
      
      process.on('close', resolve);
    });
    
  } catch (error) {
    console.error(chalk.red('Pipeline error:', error));
  }
}

if (require.main === module) {
  main().catch(console.error);
}