#!/usr/bin/env tsx
/**
 * Universal Sports Data Collector
 * Supports NFL, NBA, and MLB data collection from ESPN API
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { schemaAdapter } from '../lib/db/schema-adapter';
import axios from 'axios';
import pLimit from 'p-limit';

// Load environment variables
config({ path: '.env.local' });

// ESPN API configuration
const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

// Sport configurations
const SPORTS_CONFIG = {
  nfl: {
    name: 'football',
    league: 'nfl',
    seasonType: 2, // Regular season
    limit: 100,
    positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OL', 'DL', 'LB', 'DB']
  },
  nba: {
    name: 'basketball', 
    league: 'nba',
    seasonType: 2,
    limit: 100,
    positions: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'C-F', 'F-C', 'G-F']
  },
  mlb: {
    name: 'baseball',
    league: 'mlb',
    seasonType: 2,
    limit: 100,
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'RP', 'SP']
  }
};

// Stat mappings for different sports
const STAT_MAPPINGS = {
  nfl: {
    passing: ['passing_yards', 'passing_tds', 'interceptions', 'completions', 'attempts'],
    rushing: ['rushing_yards', 'rushing_tds', 'carries'],
    receiving: ['receiving_yards', 'receiving_tds', 'receptions', 'targets'],
    defense: ['tackles', 'sacks', 'interceptions', 'forced_fumbles']
  },
  nba: {
    scoring: ['points', 'field_goals_made', 'field_goals_attempted', 'three_pointers_made', 'three_pointers_attempted'],
    rebounding: ['rebounds', 'offensive_rebounds', 'defensive_rebounds'],
    playmaking: ['assists', 'turnovers', 'steals'],
    defense: ['blocks', 'steals', 'personal_fouls']
  },
  mlb: {
    batting: ['batting_avg', 'home_runs', 'rbi', 'runs', 'hits', 'doubles', 'triples', 'stolen_bases'],
    pitching: ['era', 'wins', 'losses', 'saves', 'strikeouts', 'walks', 'innings_pitched', 'whip'],
    fielding: ['putouts', 'assists', 'errors', 'fielding_percentage']
  }
};

interface CollectorStats {
  players: number;
  games: number;
  stats: number;
  errors: number;
}

export class UniversalSportsCollector {
  private stats: Record<string, CollectorStats> = {
    nfl: { players: 0, games: 0, stats: 0, errors: 0 },
    nba: { players: 0, games: 0, stats: 0, errors: 0 },
    mlb: { players: 0, games: 0, stats: 0, errors: 0 }
  };
  
  private limit = pLimit(5); // Concurrent API requests limit

  async collectAll() {
    console.log(chalk.bold.cyan('\n🌍 UNIVERSAL SPORTS COLLECTOR STARTING...'));
    console.log(chalk.gray('='.repeat(50)));
    
    const startTime = Date.now();
    
    // Collect data for all sports in parallel
    await Promise.all([
      this.collectSportData('nfl'),
      this.collectSportData('nba'),
      this.collectSportData('mlb')
    ]);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    this.printSummary(duration);
  }

  private async collectSportData(sport: 'nfl' | 'nba' | 'mlb') {
    const config = SPORTS_CONFIG[sport];
    console.log(chalk.yellow(`\n🏆 Collecting ${sport.toUpperCase()} data...`));
    
    try {
      // Collect games
      const games = await this.collectGames(sport, config);
      console.log(chalk.green(`  ✅ Found ${games.length} ${sport.toUpperCase()} games`));
      
      // Process games and collect player stats
      const gamePromises = games.slice(0, 10).map(game => 
        this.limit(() => this.processGame(sport, game))
      );
      
      await Promise.all(gamePromises);
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Error collecting ${sport} data:`), error.message);
      this.stats[sport].errors++;
    }
  }

  private async collectGames(sport: string, config: any): Promise<any[]> {
    try {
      const url = `${ESPN_BASE_URL}/${config.name}/${config.league}/scoreboard`;
      const response = await axios.get(url, {
        params: {
          limit: config.limit,
          seasontype: config.seasonType
        }
      });
      
      return response.data?.events || [];
    } catch (error) {
      console.error(chalk.red(`Failed to fetch ${sport} games:`, error.message));
      return [];
    }
  }

  private async processGame(sport: 'nfl' | 'nba' | 'mlb', game: any) {
    try {
      // Extract game data
      const gameData = {
        external_id: `espn_${sport}_${game.id}`,
        home_team: game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName || 'Unknown',
        away_team: game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName || 'Unknown',
        home_score: parseInt(game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.score || '0'),
        away_score: parseInt(game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.score || '0'),
        status: game.status?.type?.completed ? 'completed' : 'scheduled',
        game_date: game.date,
        sport: SPORTS_CONFIG[sport].name,
        venue: game.competitions[0]?.venue?.fullName,
        attendance: game.competitions[0]?.attendance
      };
      
      // Upsert game
      const gameId = await schemaAdapter.upsertGame(gameData);
      if (gameId) {
        this.stats[sport].games++;
        
        // Collect player stats for this game
        await this.collectGameStats(sport, game, gameId);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error processing ${sport} game:`, error.message));
      this.stats[sport].errors++;
    }
  }

  private async collectGameStats(sport: 'nfl' | 'nba' | 'mlb', game: any, gameId: number) {
    try {
      // Get boxscore data
      const boxscoreUrl = `${ESPN_BASE_URL}/${SPORTS_CONFIG[sport].name}/${SPORTS_CONFIG[sport].league}/summary`;
      const response = await axios.get(boxscoreUrl, {
        params: { event: game.id }
      });
      
      const boxscore = response.data?.boxscore;
      if (!boxscore) return;
      
      // Process each team's players
      for (const team of boxscore.teams || []) {
        for (const playerGroup of team.statistics || []) {
          for (const player of playerGroup.athletes || []) {
            await this.processPlayerStats(sport, player, gameId, game.date);
          }
        }
      }
      
    } catch (error) {
      console.error(chalk.red(`Error collecting stats for ${sport} game:`, error.message));
      this.stats[sport].errors++;
    }
  }

  private async processPlayerStats(sport: 'nfl' | 'nba' | 'mlb', player: any, gameId: number, gameDate: string) {
    try {
      // Upsert player
      const playerId = await schemaAdapter.upsertPlayer({
        name: player.athlete?.displayName || 'Unknown Player',
        position: player.athlete?.position?.abbreviation || 'Unknown',
        team: player.athlete?.team?.displayName || 'Unknown Team',
        sport: SPORTS_CONFIG[sport].name,
        external_id: `espn_${sport}_player_${player.athlete?.id}`,
        jersey_number: player.athlete?.jersey
      }, 'espn');
      
      if (!playerId) return;
      this.stats[sport].players++;
      
      // Parse and store stats
      const stats = this.parsePlayerStats(sport, player);
      if (Object.keys(stats).length > 0) {
        await schemaAdapter.upsertPlayerStats({
          player_id: playerId,
          game_id: gameId,
          stats: stats,
          fantasy_points: this.calculateFantasyPoints(sport, stats),
          game_date: gameDate
        });
        this.stats[sport].stats++;
      }
      
    } catch (error) {
      console.error(chalk.red(`Error processing player stats:`, error.message));
      this.stats[sport].errors++;
    }
  }

  private parsePlayerStats(sport: 'nfl' | 'nba' | 'mlb', player: any): Record<string, any> {
    const stats: Record<string, any> = {};
    
    // Sport-specific stat parsing
    switch (sport) {
      case 'nfl':
        return this.parseNFLStats(player);
      case 'nba':
        return this.parseNBAStats(player);
      case 'mlb':
        return this.parseMLBStats(player);
      default:
        return stats;
    }
  }

  private parseNFLStats(player: any): Record<string, any> {
    const stats: Record<string, any> = {};
    const statGroups = player.stats || [];
    
    statGroups.forEach(group => {
      if (group.name === 'passing') {
        stats.passing_yards = parseFloat(group.stats[0] || 0);
        stats.passing_tds = parseFloat(group.stats[1] || 0);
        stats.interceptions = parseFloat(group.stats[2] || 0);
      } else if (group.name === 'rushing') {
        stats.rushing_yards = parseFloat(group.stats[0] || 0);
        stats.rushing_tds = parseFloat(group.stats[1] || 0);
        stats.carries = parseFloat(group.stats[2] || 0);
      } else if (group.name === 'receiving') {
        stats.receiving_yards = parseFloat(group.stats[0] || 0);
        stats.receiving_tds = parseFloat(group.stats[1] || 0);
        stats.receptions = parseFloat(group.stats[2] || 0);
      }
    });
    
    return stats;
  }

  private parseNBAStats(player: any): Record<string, any> {
    const stats: Record<string, any> = {};
    const statLine = player.stats || [];
    
    // NBA stats are typically in a flat array
    if (statLine.length >= 15) {
      stats.minutes = parseFloat(statLine[0] || 0);
      stats.points = parseFloat(statLine[1] || 0);
      stats.rebounds = parseFloat(statLine[2] || 0);
      stats.assists = parseFloat(statLine[3] || 0);
      stats.steals = parseFloat(statLine[4] || 0);
      stats.blocks = parseFloat(statLine[5] || 0);
      stats.field_goals_made = parseFloat(statLine[6] || 0);
      stats.field_goals_attempted = parseFloat(statLine[7] || 0);
      stats.three_pointers_made = parseFloat(statLine[8] || 0);
      stats.three_pointers_attempted = parseFloat(statLine[9] || 0);
    }
    
    return stats;
  }

  private parseMLBStats(player: any): Record<string, any> {
    const stats: Record<string, any> = {};
    const statGroups = player.stats || [];
    
    statGroups.forEach(group => {
      if (group.name === 'batting') {
        stats.at_bats = parseFloat(group.stats[0] || 0);
        stats.runs = parseFloat(group.stats[1] || 0);
        stats.hits = parseFloat(group.stats[2] || 0);
        stats.rbi = parseFloat(group.stats[3] || 0);
        stats.home_runs = parseFloat(group.stats[4] || 0);
        stats.batting_avg = parseFloat(group.stats[5] || 0);
      } else if (group.name === 'pitching') {
        stats.innings_pitched = parseFloat(group.stats[0] || 0);
        stats.hits_allowed = parseFloat(group.stats[1] || 0);
        stats.runs_allowed = parseFloat(group.stats[2] || 0);
        stats.earned_runs = parseFloat(group.stats[3] || 0);
        stats.strikeouts = parseFloat(group.stats[4] || 0);
        stats.walks = parseFloat(group.stats[5] || 0);
        stats.era = parseFloat(group.stats[6] || 0);
      }
    });
    
    return stats;
  }

  private calculateFantasyPoints(sport: 'nfl' | 'nba' | 'mlb', stats: Record<string, any>): number {
    let points = 0;
    
    switch (sport) {
      case 'nfl':
        // Standard fantasy scoring
        points += (stats.passing_yards || 0) * 0.04;
        points += (stats.passing_tds || 0) * 4;
        points -= (stats.interceptions || 0) * 2;
        points += (stats.rushing_yards || 0) * 0.1;
        points += (stats.rushing_tds || 0) * 6;
        points += (stats.receiving_yards || 0) * 0.1;
        points += (stats.receiving_tds || 0) * 6;
        points += (stats.receptions || 0) * 0.5; // PPR
        break;
        
      case 'nba':
        // DFS-style scoring
        points += (stats.points || 0) * 1;
        points += (stats.rebounds || 0) * 1.2;
        points += (stats.assists || 0) * 1.5;
        points += (stats.steals || 0) * 3;
        points += (stats.blocks || 0) * 3;
        points -= (stats.turnovers || 0) * 1;
        break;
        
      case 'mlb':
        // Batting scoring
        points += (stats.runs || 0) * 2;
        points += (stats.rbi || 0) * 2;
        points += (stats.home_runs || 0) * 4;
        points += (stats.stolen_bases || 0) * 2;
        points += (stats.hits || 0) * 1;
        // Pitching scoring
        points += (stats.innings_pitched || 0) * 2.25;
        points += (stats.strikeouts || 0) * 2;
        points += (stats.wins || 0) * 4;
        points -= (stats.earned_runs || 0) * 2;
        break;
    }
    
    return Math.round(points * 100) / 100;
  }

  getStats(): Record<string, CollectorStats> {
    return this.stats;
  }

  private printSummary(duration: number) {
    console.log(chalk.bold.cyan('\n📊 COLLECTION SUMMARY'));
    console.log(chalk.gray('='.repeat(50)));
    
    let totalPlayers = 0, totalGames = 0, totalStats = 0, totalErrors = 0;
    
    for (const [sport, stats] of Object.entries(this.stats)) {
      console.log(chalk.yellow(`\n${sport.toUpperCase()}:`));
      console.log(`  Players: ${chalk.green(stats.players)}`);
      console.log(`  Games: ${chalk.green(stats.games)}`);
      console.log(`  Stats: ${chalk.green(stats.stats)}`);
      if (stats.errors > 0) {
        console.log(`  Errors: ${chalk.red(stats.errors)}`);
      }
      
      totalPlayers += stats.players;
      totalGames += stats.games;
      totalStats += stats.stats;
      totalErrors += stats.errors;
    }
    
    console.log(chalk.bold.cyan('\n📈 TOTALS:'));
    console.log(`  Total Players: ${chalk.green(totalPlayers)}`);
    console.log(`  Total Games: ${chalk.green(totalGames)}`);
    console.log(`  Total Stats: ${chalk.green(totalStats)}`);
    console.log(`  Total Errors: ${chalk.red(totalErrors)}`);
    console.log(`  Duration: ${chalk.yellow(duration + 's')}`);
    
    console.log(chalk.bold.green('\n✨ Universal sports collection complete!'));
  }
}

// Run the collector if this is the main module
if (require.main === module) {
  const collector = new UniversalSportsCollector();
  collector.collectAll().catch(console.error);
}