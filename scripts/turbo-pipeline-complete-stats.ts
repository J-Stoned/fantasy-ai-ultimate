#!/usr/bin/env tsx
/**
 * 🚀 TURBO PIPELINE WITH COMPLETE STAT MAPPINGS
 * 
 * Captures ALL stats from ESPN API (not just basic stats)
 * Target: 78 stats per game (not 58)
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { spawn } from 'child_process';
import { InMemoryCache } from './utils/memory-cache';
import { StatsBuffer, BufferedStat } from './utils/stats-buffer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(12); // 12 threads for Ryzen 5 7600X

// ESPN API sport paths
const ESPN_SPORTS: Record<string, string> = {
  'NFL': 'football/nfl',
  'NBA': 'basketball/nba',
  'MLB': 'baseball/mlb',
  'NHL': 'hockey/nhl'
};

// COMPLETE stat mappings including ALL ESPN stats
const STAT_MAPPINGS: Record<string, Record<string, string>> = {
  'NFL': {
    // Passing stats
    'C/ATT': 'completions_attempts',
    'YDS': 'passing_yards',
    'PASSYDS': 'passing_yards',
    'AVG': 'passing_avg',
    'TD': 'passing_touchdowns',
    'PASSTD': 'passing_touchdowns',
    'INT': 'interceptions',
    'SACKS': 'sacks_taken',
    'QBR': 'qb_rating',
    'RTG': 'passer_rating',
    
    // Rushing stats
    'CAR': 'rushing_attempts',
    'RUSHYDS': 'rushing_yards',
    'RUSHTD': 'rushing_touchdowns',
    'LONG': 'rushing_long',
    
    // Receiving stats
    'REC': 'receptions',
    'RECYDS': 'receiving_yards',
    'RECTD': 'receiving_touchdowns',
    'TGTS': 'targets',
    
    // Defensive stats
    'TOT': 'total_tackles',
    'SOLO': 'solo_tackles',
    'TFL': 'tackles_for_loss',
    'PD': 'passes_defended',
    'QB HTS': 'qb_hits',
    
    // Fumble stats
    'FUM': 'fumbles',
    'LOST': 'fumbles_lost',
    
    // Kicking stats
    'FG': 'field_goals',
    'PCT': 'field_goal_pct',
    'XP': 'extra_points',
    'PTS': 'kicking_points',
    
    // Punting stats
    'NO': 'punts',
    'TB': 'touchbacks',
    'In 20': 'inside_20',
    
    // Return stats
    'NO': 'returns',
    'AVG': 'return_avg'
  },
  'NBA': {
    'MIN': 'minutes_played',
    'PTS': 'points',
    'REB': 'rebounds',
    'AST': 'assists',
    'STL': 'steals',
    'BLK': 'blocks',
    'TO': 'turnovers',
    'FGM': 'field_goals_made',
    'FGA': 'field_goals_attempted',
    '3PM': 'three_pointers_made',
    '3PA': 'three_pointers_attempted',
    'FTM': 'free_throws_made',
    'FTA': 'free_throws_attempted',
    'OREB': 'offensive_rebounds',
    'DREB': 'defensive_rebounds',
    'PF': 'personal_fouls'
  },
  'MLB': {
    'AB': 'at_bats',
    'H': 'hits',
    'R': 'runs',
    'RBI': 'runs_batted_in',
    'HR': 'home_runs',
    'BB': 'walks',
    'SO': 'strikeouts',
    '2B': 'doubles',
    '3B': 'triples',
    'SB': 'stolen_bases',
    'AVG': 'batting_average',
    'OBP': 'on_base_percentage',
    'SLG': 'slugging_percentage'
  },
  'NHL': {
    'G': 'goals',
    'A': 'assists',
    'PTS': 'points',
    'SOG': 'shots_on_goal',
    '+/-': 'plus_minus',
    'PIM': 'penalty_minutes',
    'PPG': 'power_play_goals',
    'PPA': 'power_play_assists',
    'SHG': 'short_handed_goals',
    'SHA': 'short_handed_assists',
    'GWG': 'game_winning_goals',
    'OTG': 'overtime_goals'
  }
};

class TurboPipelineCompleteStats {
  private cache!: InMemoryCache;
  private statsBuffer!: StatsBuffer;
  private progressBar: cliProgress.SingleBar;
  private startTime: number = 0;
  private collectedStats = 0;
  
  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Speed: {speed} stats/sec | ETA: {eta_formatted}',
      barCompleteChar: '█',
      barIncompleteChar: '░'
    }, cliProgress.Presets.shades_classic);
  }
  
  async initialize() {
    console.log(chalk.bold.cyan('🚀 TURBO PIPELINE WITH COMPLETE STATS\n'));
    console.log(chalk.yellow('Target: 78 stats per game (not 58)\n'));
    console.log(chalk.yellow('Initializing 32GB RAM cache...'));
    
    this.cache = new InMemoryCache();
    await this.cache.initialize();
    
    this.statsBuffer = new StatsBuffer();
    
    const stats = this.cache.getStats();
    console.log(chalk.green(`✅ Cache loaded: ${stats.teams} teams, ${stats.players} players, ${stats.games} games\n`));
  }
  
  async collectHistoricalData(sport: string, year: number) {
    this.startTime = Date.now();
    
    // First collect any missing games
    await this.collectGames(sport, year);
    
    // Then collect stats with COMPLETE mappings
    await this.collectStats(sport, year);
    
    // Flush remaining stats
    await this.flushStatsBuffer();
    
    const duration = (Date.now() - this.startTime) / 1000;
    const speed = Math.round(this.collectedStats / duration);
    
    console.log(chalk.bold.green(`\n✅ Collection complete!`));
    console.log(chalk.cyan(`   Total stats collected: ${this.collectedStats.toLocaleString()}`));
    console.log(chalk.cyan(`   Time taken: ${Math.round(duration)}s`));
    console.log(chalk.cyan(`   Average speed: ${speed} stats/second`));
  }
  
  private async collectGames(sport: string, year: number) {
    console.log(chalk.bold.blue(`📅 Checking for ${sport} ${year} games...`));
    
    return new Promise<void>((resolve) => {
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
    console.log(chalk.bold.yellow(`\n📊 Collecting ${sport} ${year} stats with COMPLETE mappings...`));
    
    await this.cache.initialize();
    
    const games = await this.cache.getGamesForSportYear(sport, year);
    if (!games.length) {
      console.log(chalk.red(`No games found for ${sport} ${year}`));
      return;
    }
    
    console.log(chalk.blue(`Found ${games.length} games to process`));
    
    // Setup progress bar
    const estimatedStats = games.length * 78; // Target: 78 stats per game
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
          
          // Process ALL stat groups
          for (const statGroup of team.statistics || []) {
            const statGroupName = statGroup.name.toLowerCase();
            
            for (const athlete of statGroup.athletes || []) {
              const player = this.cache.getPlayerByExternalId(
                `espn_${sport.toLowerCase()}_${athlete.athlete.id}`
              );
              
              if (!player) continue;
              
              // Transform stats with COMPLETE mappings
              const transformedStats = this.transformCompleteStats(
                athlete.stats || [],
                statGroup.labels || statGroup.names || [],
                sport,
                statGroupName
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
                  collection_source: 'turbo-complete-stats',
                  stat_group: statGroupName
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

  private transformCompleteStats(
    statValues: any[],
    statLabels: string[],
    sport: string,
    statGroupName: string
  ): Record<string, any> {
    const stats: Record<string, any> = {};
    const mapping = STAT_MAPPINGS[sport] || {};
    
    // Handle special cases where the same label appears in different contexts
    statLabels.forEach((label, index) => {
      const value = statValues[index];
      if (value === undefined || value === null) return;
      
      let mappedKey = mapping[label];
      
      // Handle context-specific mappings for NFL
      if (sport === 'NFL') {
        // Different YDS meanings based on stat group
        if (label === 'YDS') {
          if (statGroupName.includes('pass')) mappedKey = 'passing_yards';
          else if (statGroupName.includes('rush')) mappedKey = 'rushing_yards';
          else if (statGroupName.includes('rec')) mappedKey = 'receiving_yards';
          else if (statGroupName.includes('punt') || statGroupName.includes('kick')) mappedKey = 'return_yards';
        }
        
        // Different TD meanings
        if (label === 'TD') {
          if (statGroupName.includes('pass')) mappedKey = 'passing_touchdowns';
          else if (statGroupName.includes('rush')) mappedKey = 'rushing_touchdowns';
          else if (statGroupName.includes('rec')) mappedKey = 'receiving_touchdowns';
          else if (statGroupName.includes('def')) mappedKey = 'defensive_touchdowns';
        }
        
        // Different NO meanings (returns vs punts)
        if (label === 'NO') {
          if (statGroupName.includes('return')) mappedKey = 'returns';
          else if (statGroupName.includes('punt')) mappedKey = 'punts';
        }
      }
      
      if (mappedKey) {
        // Handle compound stats like "18/32" for completions/attempts
        if (typeof value === 'string' && value.includes('/')) {
          const parts = value.split('/');
          if (parts.length === 2 && label === 'C/ATT') {
            stats['completions'] = parseInt(parts[0]) || 0;
            stats['attempts'] = parseInt(parts[1]) || 0;
          } else {
            stats[mappedKey] = value;
          }
        } else {
          stats[mappedKey] = value;
        }
      }
    });
    
    return stats;
  }

  private calculateFantasyPoints(stats: any, sport: string): number {
    let points = 0;
    
    switch (sport) {
      case 'NFL':
        // Passing
        points += (stats.passing_yards || 0) / 25;
        points += (stats.passing_touchdowns || 0) * 4;
        points -= (stats.interceptions || 0) * 2;
        
        // Rushing
        points += (stats.rushing_yards || 0) / 10;
        points += (stats.rushing_touchdowns || 0) * 6;
        
        // Receiving
        points += (stats.receiving_yards || 0) / 10;
        points += (stats.receiving_touchdowns || 0) * 6;
        points += (stats.receptions || 0) * 0.5;
        
        // Defensive
        points += (stats.sacks || 0) * 1;
        points += (stats.defensive_touchdowns || 0) * 6;
        points += (stats.interceptions || 0) * 2;
        
        // Kicking
        points += (stats.field_goals || 0) * 3;
        points += (stats.extra_points || 0) * 1;
        break;
        
      case 'NBA':
        points = (stats.points || 0) + 
                 (stats.rebounds || 0) * 1.2 + 
                 (stats.assists || 0) * 1.5 + 
                 (stats.steals || 0) * 3 + 
                 (stats.blocks || 0) * 3 - 
                 (stats.turnovers || 0);
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
                 (stats.shots_on_goal || 0) * 0.5 +
                 (stats.power_play_goals || 0) * 1 +
                 (stats.short_handed_goals || 0) * 2;
        break;
    }
    
    return Math.max(0, points);
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
        console.error(chalk.red(`Error inserting batch: ${error.message}`));
      } else {
        console.log(chalk.green(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(stats.length/batchSize)}`));
      }
    }
    
    this.statsBuffer.clear();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const sport = args[0]?.toUpperCase() || 'NFL';
  const year = parseInt(args[1]) || 2021;
  
  const pipeline = new TurboPipelineCompleteStats();
  await pipeline.initialize();
  await pipeline.collectHistoricalData(sport, year);
}

main().catch(console.error);