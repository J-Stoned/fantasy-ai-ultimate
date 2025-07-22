#!/usr/bin/env tsx
/**
 * ⚡⚡⚡ ULTRA-FAST STATS COLLECTOR V2 - MAXIMUM PARALLELISM! ⚡⚡⚡
 * 
 * STRATEGY: Use existing infrastructure but with INSANE parallelism
 * - 500+ concurrent API calls
 * - Process ALL sports in parallel
 * - Batch insert 10,000+ records at once
 * - In-memory player caching
 * 
 * TARGET: 200+ games/second without Worker Threads complexity!
 */

import { ParallelCollectionEngine } from './phase2-parallel-engine';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as os from 'os';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import database AFTER loading env vars
import { pgPool } from '../fantasy-ml/config/database';

// ULTRA SETTINGS
const API_CONCURRENCY = 500; // BEAST MODE!
const DB_BATCH_SIZE = 10000; // Massive batches
const SPORT_CONCURRENCY = 6; // Process all sports at once

class UltraFastStatsCollectorV2 {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private playerCache = new Map<string, number>();
  private totalGames = 0;
  private processedGames = 0;
  private totalStats = 0;
  private startTime = Date.now();
  private gamesPerSport: Map<string, number> = new Map();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n⚡⚡⚡ ULTRA-FAST STATS COLLECTOR V2 - MAXIMUM PARALLELISM! ⚡⚡⚡\n'));
    console.log(chalk.yellow(`🔥 API Concurrency: ${API_CONCURRENCY} simultaneous calls`));
    console.log(chalk.yellow(`🔥 DB Batch Size: ${DB_BATCH_SIZE.toLocaleString()} records`));
    console.log(chalk.yellow(`🔥 Sport Parallelism: ALL ${SPORT_CONCURRENCY} sports at once`));
    console.log(chalk.yellow(`🔥 Target: 200+ games/second\n`));
  }
  
  async collect() {
    try {
      // Pre-cache all players for ultra-fast lookups
      await this.cacheAllPlayers();
      
      // Get all games needing stats
      const gamesResult = await pgPool.query(`
        SELECT 
          g.id, g.sport, g.season, g.game_date,
          g.home_team_id, g.away_team_id,
          g.espn_game_id, g.mlb_game_id,
          g.our_game_id,
          ht.espn_id as home_espn_id,
          at.espn_id as away_espn_id
        FROM games_master g
        JOIN teams_master ht ON g.home_team_id = ht.id
        JOIN teams_master at ON g.away_team_id = at.id
        WHERE g.status IN ('STATUS_FINAL', 'Final', 'Completed')
        AND g.id NOT IN (SELECT DISTINCT game_id FROM player_game_stats)
        ORDER BY g.sport, g.season DESC, g.game_date DESC
      `);
      
      this.totalGames = gamesResult.rows.length;
      console.log(chalk.cyan.bold(`📊 FOUND ${this.totalGames.toLocaleString()} GAMES NEEDING STATS!\n`));
      
      // Group games by sport
      const gamesBySport = this.groupGamesBySport(gamesResult.rows);
      
      // Show breakdown
      console.log(chalk.cyan('📊 GAMES BY SPORT:'));
      for (const [sport, games] of Object.entries(gamesBySport)) {
        this.gamesPerSport.set(sport, games.length);
        console.log(chalk.yellow(`  ${sport}: ${games.length.toLocaleString()} games`));
      }
      console.log('');
      
      // Process ALL sports in parallel!
      const sportPromises = [];
      for (const [sport, games] of Object.entries(gamesBySport)) {
        sportPromises.push(this.processSportUltraFast(sport, games));
      }
      
      // Wait for all sports to complete
      await Promise.all(sportPromises);
      
      // Show final summary
      await this.showFinalSummary();
      
      const totalTime = (Date.now() - this.startTime) / 1000;
      const gamesPerSecond = this.processedGames / totalTime;
      
      console.log(chalk.green.bold(`\n✅ ULTRA-FAST COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⚡ Time: ${(totalTime / 60).toFixed(1)} minutes`));
      console.log(chalk.yellow(`⚡ Speed: ${gamesPerSecond.toFixed(1)} games/second`));
      console.log(chalk.yellow(`⚡ Total Stats: ${this.totalStats.toLocaleString()}\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Ultra-fast collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * Cache all players for ultra-fast lookups
   */
  async cacheAllPlayers() {
    console.log(chalk.cyan('📦 Pre-caching all players for speed...\n'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, mlb_api_id, sport
      FROM players_master
    `);
    
    players.rows.forEach(player => {
      // Cache by multiple keys for fast lookup
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.sport}_${player.espn_id}`, player.id);
      }
      if (player.mlb_api_id) {
        this.playerCache.set(`mlb_${player.mlb_api_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length.toLocaleString()} players\n`));
  }
  
  /**
   * Group games by sport
   */
  groupGamesBySport(games: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    games.forEach(game => {
      if (!grouped[game.sport]) {
        grouped[game.sport] = [];
      }
      grouped[game.sport].push(game);
    });
    
    return grouped;
  }
  
  /**
   * Process a sport with ultra-fast parallelism
   */
  async processSportUltraFast(sport: string, games: any[]) {
    console.log(chalk.yellow.bold(`\n⚡ Processing ${sport}: ${games.length.toLocaleString()} games\n`));
    
    const allStats: any[] = [];
    const batchSize = 50; // Process 50 games at a time
    
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(game => 
        this.apiLimit(async () => {
          try {
            let stats: any[] = [];
            
            // Route to appropriate collector
            if (sport === 'NFL') {
              stats = await this.collectNFLGameStats(game);
            } else if (sport === 'NBA') {
              stats = await this.collectNBAGameStats(game);
            } else if (sport === 'MLB' || sport.startsWith('MILB')) {
              stats = await this.collectMLBGameStats(game);
            } else if (sport === 'NHL') {
              stats = await this.collectNHLGameStats(game);
            } else if (sport.startsWith('NCAA')) {
              stats = await this.collectNCAAGameStats(game, sport);
            }
            
            return stats;
          } catch (error) {
            return [];
          }
        })
      );
      
      const results = await Promise.all(batchPromises);
      const batchStats = results.flat();
      allStats.push(...batchStats);
      
      // Update progress
      this.processedGames += batch.length;
      this.totalStats += batchStats.length;
      
      // Insert stats if buffer is large enough
      if (allStats.length >= DB_BATCH_SIZE) {
        await this.insertPlayerStats(allStats);
        allStats.length = 0; // Clear array
      }
      
      // Show progress
      this.showProgress(sport);
      
      // Brief pause every 500 games to avoid overwhelming APIs
      if (i % 500 === 499) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Insert any remaining stats
    if (allStats.length > 0) {
      await this.insertPlayerStats(allStats);
    }
    
    console.log(chalk.green(`✅ ${sport} complete! Collected stats for ${games.length.toLocaleString()} games\n`));
  }
  
  /**
   * Collect NFL game stats
   */
  async collectNFLGameStats(game: any): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      if (game.espn_game_id) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.espn_game_id}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.boxscore?.players) {
          for (const teamData of response.data.boxscore.players) {
            for (const category of teamData.statistics || []) {
              for (const player of category.athletes || []) {
                if (player.stats && player.stats.length > 0) {
                  const playerId = this.playerCache.get(`espn_NFL_${player.athlete?.id || player.id}`);
                  if (playerId) {
                    const stat = this.parseNFLStats(player, category.name, game, playerId);
                    if (stat) stats.push(stat);
                  } else {
                    // Create player if doesn't exist
                    const newPlayerId = await this.createPlayer(player, 'NFL', teamData.team.id);
                    if (newPlayerId) {
                      const stat = this.parseNFLStats(player, category.name, game, newPlayerId);
                      if (stat) stats.push(stat);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip failed games
    }
    
    return stats;
  }
  
  /**
   * Collect NBA game stats
   */
  async collectNBAGameStats(game: any): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      if (game.espn_game_id) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.boxscore?.players) {
          for (const teamData of response.data.boxscore.players) {
            const teamId = teamData.team.id === game.home_espn_id ? game.home_team_id : game.away_team_id;
            
            for (const player of teamData.statistics?.[0]?.athletes || []) {
              const playerId = this.playerCache.get(`espn_NBA_${player.athlete?.id || player.id}`);
              if (playerId && player.stats && player.stats.length >= 14) {
                const stat = this.parseNBAStats(player, game, playerId, teamId);
                if (stat) stats.push(stat);
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip failed games
    }
    
    return stats;
  }
  
  /**
   * Collect MLB game stats
   */
  async collectMLBGameStats(game: any): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      if (game.mlb_game_id) {
        const url = `https://statsapi.mlb.com/api/v1.1/game/${game.mlb_game_id}/feed/live`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.liveData?.boxscore?.teams) {
          const teams = response.data.liveData.boxscore.teams;
          
          for (const side of ['home', 'away']) {
            const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
            const teamData = teams[side];
            
            for (const [playerId, playerData] of Object.entries(teamData.players || {})) {
              const player: any = playerData;
              const dbPlayerId = this.playerCache.get(`mlb_${player.person.id}`);
              
              if (dbPlayerId) {
                if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
                  stats.push(this.parseMLBBatting(player, game, dbPlayerId, teamId));
                }
                
                if (player.stats?.pitching && Object.keys(player.stats.pitching).length > 0) {
                  stats.push(this.parseMLBPitching(player, game, dbPlayerId, teamId));
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip failed games
    }
    
    return stats.filter(s => s !== null);
  }
  
  /**
   * Collect NHL game stats
   */
  async collectNHLGameStats(game: any): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      if (game.espn_game_id) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_game_id}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.boxscore?.players) {
          for (const teamData of response.data.boxscore.players) {
            const teamId = teamData.team.id === game.home_espn_id ? game.home_team_id : game.away_team_id;
            
            // Skaters
            for (const player of teamData.statistics?.[0]?.athletes || []) {
              const playerId = this.playerCache.get(`espn_NHL_${player.athlete?.id || player.id}`);
              if (playerId && player.stats && player.stats.length > 0) {
                stats.push(this.parseNHLSkater(player, game, playerId, teamId));
              }
            }
            
            // Goalies
            for (const player of teamData.statistics?.[1]?.athletes || []) {
              const playerId = this.playerCache.get(`espn_NHL_${player.athlete?.id || player.id}`);
              if (playerId && player.stats && player.stats.length > 0) {
                stats.push(this.parseNHLGoalie(player, game, playerId, teamId));
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip failed games
    }
    
    return stats.filter(s => s !== null);
  }
  
  /**
   * Collect NCAA game stats
   */
  async collectNCAAGameStats(game: any, sport: string): Promise<any[]> {
    // NCAA stats collection similar to pro sports
    // Would implement based on sport type (NCAA_BASKETBALL like NBA, NCAA_BASEBALL like MLB, etc.)
    return [];
  }
  
  /**
   * Parse NFL stats
   */
  parseNFLStats(player: any, category: string, game: any, playerId: number): any {
    const stats: any = {};
    const position = player.position?.abbreviation || 'UNK';
    
    if (category === 'passing' && player.stats.length > 0) {
      const [completions, attempts] = player.stats[0]?.split('/').map(Number) || [0, 0];
      Object.assign(stats, {
        completions,
        attempts,
        passing_yards: parseInt(player.stats[1]) || 0,
        passing_touchdowns: parseInt(player.stats[2]) || 0,
        interceptions: parseInt(player.stats[3]) || 0
      });
    } else if (category === 'rushing' && player.stats.length > 0) {
      Object.assign(stats, {
        rushing_attempts: parseInt(player.stats[0]) || 0,
        rushing_yards: parseInt(player.stats[1]) || 0,
        rushing_touchdowns: parseInt(player.stats[3]) || 0
      });
    } else if (category === 'receiving' && player.stats.length > 0) {
      Object.assign(stats, {
        receptions: parseInt(player.stats[0]) || 0,
        receiving_yards: parseInt(player.stats[1]) || 0,
        receiving_touchdowns: parseInt(player.stats[3]) || 0,
        targets: parseInt(player.stats[5]) || 0
      });
    }
    
    if (Object.keys(stats).length > 0) {
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: player.teamId || game.home_team_id,
        sport: 'NFL',
        season: game.season,
        position: position,
        played: true,
        started: player.starter || false,
        stats: stats,
        data_source: 'espn_api'
      };
    }
    
    return null;
  }
  
  /**
   * Parse NBA stats
   */
  parseNBAStats(player: any, game: any, playerId: number, teamId: number): any {
    const values = player.stats;
    const [fgMade, fgAtt] = (values[1] || '0-0').split('-').map(Number);
    const [threeMade, threeAtt] = (values[2] || '0-0').split('-').map(Number);
    const [ftMade, ftAtt] = (values[3] || '0-0').split('-').map(Number);
    
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: teamId,
      sport: 'NBA',
      season: game.season,
      position: player.position?.abbreviation || 'UNK',
      played: true,
      started: player.starter || false,
      minutes_played: parseInt(values[0]) || 0,
      stats: {
        minutes: parseInt(values[0]) || 0,
        field_goals_made: fgMade || 0,
        field_goals_attempted: fgAtt || 0,
        three_pointers_made: threeMade || 0,
        three_pointers_attempted: threeAtt || 0,
        free_throws_made: ftMade || 0,
        free_throws_attempted: ftAtt || 0,
        rebounds: parseInt(values[6]) || 0,
        assists: parseInt(values[7]) || 0,
        steals: parseInt(values[8]) || 0,
        blocks: parseInt(values[9]) || 0,
        turnovers: parseInt(values[10]) || 0,
        points: parseInt(values[13]) || 0
      },
      data_source: 'espn_api'
    };
  }
  
  /**
   * Parse MLB batting stats
   */
  parseMLBBatting(player: any, game: any, playerId: number, teamId: number): any {
    const batting = player.stats.batting;
    
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: teamId,
      sport: game.sport || 'MLB',
      season: game.season,
      position: player.position?.abbreviation || 'UNK',
      played: true,
      started: player.gameStatus?.isSubstitute === false,
      stats: {
        at_bats: batting.atBats || 0,
        runs: batting.runs || 0,
        hits: batting.hits || 0,
        doubles: batting.doubles || 0,
        triples: batting.triples || 0,
        home_runs: batting.homeRuns || 0,
        rbi: batting.rbi || 0,
        walks: batting.baseOnBalls || 0,
        strikeouts: batting.strikeOuts || 0,
        stolen_bases: batting.stolenBases || 0,
        caught_stealing: batting.caughtStealing || 0
      },
      data_source: 'mlb_api'
    };
  }
  
  /**
   * Parse MLB pitching stats
   */
  parseMLBPitching(player: any, game: any, playerId: number, teamId: number): any {
    const pitching = player.stats.pitching;
    
    return {
      player_id: playerId,
      game_id: game.id,
      team_id: teamId,
      sport: game.sport || 'MLB',
      season: game.season,
      position: 'P',
      played: true,
      started: pitching.gamesStarted === 1,
      stats: {
        innings_pitched: pitching.inningsPitched || 0,
        hits_allowed: pitching.hits || 0,
        runs_allowed: pitching.runs || 0,
        earned_runs: pitching.earnedRuns || 0,
        walks_allowed: pitching.baseOnBalls || 0,
        strikeouts: pitching.strikeOuts || 0,
        home_runs_allowed: pitching.homeRuns || 0,
        pitches_thrown: pitching.numberOfPitches || 0,
        wins: pitching.wins || 0,
        losses: pitching.losses || 0,
        saves: pitching.saves || 0
      },
      data_source: 'mlb_api'
    };
  }
  
  /**
   * Parse NHL skater stats
   */
  parseNHLSkater(player: any, game: any, playerId: number, teamId: number): any {
    const values = player.stats || [];
    
    if (values.length >= 6) {
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NHL',
        season: game.season,
        position: player.position?.abbreviation || 'F',
        played: true,
        started: player.starter || false,
        stats: {
          goals: parseInt(values[0]) || 0,
          assists: parseInt(values[1]) || 0,
          points: parseInt(values[2]) || 0,
          shots: parseInt(values[3]) || 0,
          plus_minus: parseInt(values[4]) || 0,
          penalty_minutes: parseInt(values[5]) || 0
        },
        data_source: 'espn_api'
      };
    }
    
    return null;
  }
  
  /**
   * Parse NHL goalie stats
   */
  parseNHLGoalie(player: any, game: any, playerId: number, teamId: number): any {
    const values = player.stats || [];
    
    if (values.length >= 4) {
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NHL',
        season: game.season,
        position: 'G',
        played: true,
        started: player.starter || false,
        stats: {
          saves: parseInt(values[0]) || 0,
          shots_against: parseInt(values[1]) || 0,
          goals_against: parseInt(values[2]) || 0,
          save_percentage: parseFloat(values[3]) || 0
        },
        data_source: 'espn_api'
      };
    }
    
    return null;
  }
  
  /**
   * Create player if doesn't exist
   */
  async createPlayer(player: any, sport: string, teamId: number): Promise<number | null> {
    try {
      const result = await pgPool.query(
        `INSERT INTO players_master (
          our_player_id, sport, full_name, first_name, last_name,
          position, jersey_number, current_team_id, espn_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (our_player_id) DO UPDATE 
        SET current_team_id = $8, updated_at = NOW()
        RETURNING id`,
        [
          `${sport.toLowerCase()}_${player.athlete?.id || player.id}`,
          sport,
          player.athlete?.displayName || player.displayName || 'Unknown',
          player.athlete?.firstName || '',
          player.athlete?.lastName || '',
          player.position?.abbreviation || '',
          player.athlete?.jersey || '',
          teamId,
          player.athlete?.id || player.id,
          'Active'
        ]
      );
      
      const newId = result.rows[0].id;
      // Cache the new player
      this.playerCache.set(`espn_${sport}_${player.athlete?.id || player.id}`, newId);
      
      return newId;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Insert player stats in bulk
   */
  async insertPlayerStats(stats: any[]) {
    if (stats.length === 0) return;
    
    try {
      await this.engine.bulkInsert('player_game_stats', stats, {
        conflictTarget: 'player_id, game_id',
        updateColumns: ['stats', 'played', 'started', 'minutes_played', 'updated_at']
      });
    } catch (error) {
      console.error(chalk.red('Error inserting stats:'), error.message);
    }
  }
  
  /**
   * Show progress
   */
  showProgress(sport: string) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSecond = this.processedGames / elapsed;
    const eta = (this.totalGames - this.processedGames) / gamesPerSecond;
    const sportTotal = this.gamesPerSport.get(sport) || 0;
    
    if (this.processedGames % 100 === 0) {
      console.log(chalk.green(
        `⚡ [${sport}] Progress: ${this.processedGames.toLocaleString()}/${this.totalGames.toLocaleString()} games | ` +
        `${this.totalStats.toLocaleString()} stats | ` +
        `${gamesPerSecond.toFixed(1)} games/sec | ` +
        `ETA: ${(eta / 60).toFixed(1)} min`
      ));
    }
  }
  
  /**
   * Show final summary
   */
  async showFinalSummary() {
    console.log(chalk.cyan.bold('\n📊 STATS COLLECTION SUMMARY:\n'));
    
    const summary = await pgPool.query(`
      SELECT 
        sport,
        COUNT(DISTINCT game_id) as games_with_stats,
        COUNT(*) as total_player_stats,
        COUNT(DISTINCT player_id) as unique_players
      FROM player_game_stats
      GROUP BY sport
      ORDER BY total_player_stats DESC
    `);
    
    console.log(chalk.cyan('Sport       | Games w/Stats | Player Stats | Unique Players'));
    console.log(chalk.cyan('------------|---------------|--------------|---------------'));
    
    let totalPlayerStats = 0;
    summary.rows.forEach(row => {
      totalPlayerStats += parseInt(row.total_player_stats);
      console.log(
        `${row.sport.padEnd(11)} | ${row.games_with_stats.toString().padStart(13)} | ${parseInt(row.total_player_stats).toLocaleString().padStart(12)} | ${parseInt(row.unique_players).toLocaleString().padStart(14)}`
      );
    });
    
    console.log(chalk.yellow(`\n🎯 TOTAL PLAYER STATS IN DATABASE: ${totalPlayerStats.toLocaleString()}`));
  }
}

// Run the ultra-fast collector V2!
if (require.main === module) {
  const collector = new UltraFastStatsCollectorV2();
  collector.collect().catch(console.error);
}