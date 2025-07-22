#!/usr/bin/env tsx
/**
 * ⚾ MiLB STATS ULTRA COLLECTOR - 81,587 GAMES!
 * 
 * Collects stats for ALL Minor League Baseball games
 * Uses MLB Stats API with ultra-high concurrency
 * 
 * Strategy:
 * - 500 concurrent API calls (MiLB can handle more than MLB)
 * - Process by year and level for better organization
 * - Batch inserts of 10,000 records
 * - Smart retry logic for failed games
 */

import { pgPool } from '../../fantasy-ml/config/database';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 800; // Ultra high concurrency for MiLB
const DB_BATCH_SIZE = 2000; // Safe batch size: 2000 * 24 columns = 48,000 params < 65,535 limit
const RETRY_LIMIT = 3;

export class MiLBStatsUltraCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames = 0;
  private processedGames = 0;
  private successfulGames = 0;
  private failedGames = 0;
  private totalStats = 0;
  private startTime = Date.now();
  private playerCache = new Map<string, number>();
  private failedGameIds = new Set<string>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n⚾ MiLB STATS ULTRA COLLECTOR - 81,587 GAMES!\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 800 calls'));
    console.log(chalk.yellow('⚡ Game Batch Size: 1,000 games'));
    console.log(chalk.yellow('⚡ DB Batch Size: 2,000 records (PostgreSQL safe)'));
    console.log(chalk.yellow('⚡ Expected time: 15-20 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all MiLB players first
      await this.cacheMiLBPlayers();
      
      // Get all MiLB games by level and year
      const gamesByLevel = await this.getGamesByLevel();
      
      // Process each level
      for (const [level, games] of Object.entries(gamesByLevel)) {
        await this.processLevel(level, games as any[]);
      }
      
      // Retry failed games
      if (this.failedGameIds.size > 0) {
        console.log(chalk.yellow(`\n🔄 Retrying ${this.failedGameIds.size} failed games...\n`));
        await this.retryFailedGames();
      }
      
      // Final summary
      const totalTime = (Date.now() - this.startTime) / 1000 / 60;
      console.log(chalk.green.bold('\n' + '='.repeat(60)));
      console.log(chalk.green.bold('✅ MiLB STATS COLLECTION COMPLETE!'));
      console.log(chalk.green.bold('='.repeat(60)));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)} minutes`));
      console.log(chalk.yellow(`📊 Total games: ${this.totalGames.toLocaleString()}`));
      console.log(chalk.yellow(`✅ Successful: ${this.successfulGames.toLocaleString()}`));
      console.log(chalk.yellow(`❌ Failed: ${this.failedGames.toLocaleString()}`));
      console.log(chalk.yellow(`📈 Stats collected: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.totalGames / (totalTime * 60)).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ MiLB collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  private async cacheMiLBPlayers() {
    console.log(chalk.cyan('📦 Caching MiLB players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, mlb_id, name, sport
      FROM players_master
      WHERE sport LIKE 'MILB%'
      OR sport = 'MLB' -- MLB players often play in minors
    `);
    
    players.rows.forEach(player => {
      if (player.mlb_id) {
        this.playerCache.set(`mlb_${player.mlb_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} players\n`));
  }
  
  private async getGamesByLevel() {
    console.log(chalk.cyan('📊 Organizing games by level...\n'));
    
    const result = await pgPool.query(`
      SELECT 
        g.id,
        g.sport,
        g.mlb_game_id,
        g.game_date,
        g.home_team_id,
        g.away_team_id,
        EXTRACT(YEAR FROM g.game_date) as year
      FROM games_master g
      WHERE g.sport LIKE 'MILB%'
      AND g.mlb_game_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM player_game_stats pgs 
        WHERE pgs.game_id = g.id
      )
      ORDER BY g.sport, g.game_date DESC
    `);
    
    this.totalGames = result.rows.length;
    console.log(chalk.yellow(`Found ${this.totalGames.toLocaleString()} MiLB games needing stats\n`));
    
    // Group by level
    const gamesByLevel: Record<string, any[]> = {};
    result.rows.forEach(game => {
      if (!gamesByLevel[game.sport]) {
        gamesByLevel[game.sport] = [];
      }
      gamesByLevel[game.sport].push(game);
    });
    
    // Show counts
    Object.entries(gamesByLevel).forEach(([level, games]) => {
      console.log(chalk.cyan(`  ${level}: ${games.length.toLocaleString()} games`));
    });
    
    return gamesByLevel;
  }
  
  private async processLevel(level: string, games: any[]) {
    console.log(chalk.yellow.bold(`\n\n⚾ PROCESSING ${level} (${games.length.toLocaleString()} games)...\n`));
    
    const BATCH_SIZE = 1000; // Process 1000 games at a time for maximum speed
    const allStats: any[] = [];
    
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(games.length / BATCH_SIZE);
      
      console.log(chalk.gray(`  Batch ${batchNum}/${totalBatches}...`));
      
      // Process batch in parallel
      const batchStats = await this.processBatch(batch);
      allStats.push(...batchStats);
      
      // Insert when we have enough
      if (allStats.length >= DB_BATCH_SIZE) {
        await this.insertStats(allStats.splice(0, DB_BATCH_SIZE));
      }
      
      // Show progress
      this.showProgress();
      
      // Small delay between batches to prevent overwhelming the API
      if (i > 0 && i % 3000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Insert remaining stats
    if (allStats.length > 0) {
      await this.insertStats(allStats);
    }
  }
  
  private async processBatch(games: any[]): Promise<any[]> {
    const promises = games.map(game => 
      this.apiLimit(() => this.collectGameStats(game))
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  private async collectGameStats(game: any, retryCount = 0): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      const url = `https://statsapi.mlb.com/api/v1.1/game/${game.mlb_game_id}/feed/live`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 MiLB Stats Collector'
        }
      });
      
      if (response.data.liveData?.boxscore?.teams) {
        // Process home team
        const homeStats = await this.parseTeamStats(
          response.data.liveData.boxscore.teams.home,
          game,
          game.home_team_id,
          'home'
        );
        stats.push(...homeStats);
        
        // Process away team
        const awayStats = await this.parseTeamStats(
          response.data.liveData.boxscore.teams.away,
          game,
          game.away_team_id,
          'away'
        );
        stats.push(...awayStats);
        
        this.successfulGames++;
      } else {
        throw new Error('No boxscore data');
      }
      
    } catch (error: any) {
      if (retryCount < RETRY_LIMIT && error.code === 'ECONNRESET') {
        // Retry on connection reset
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.collectGameStats(game, retryCount + 1);
      }
      
      this.failedGames++;
      this.failedGameIds.add(game.mlb_game_id);
      
      if (error.response?.status !== 404 && retryCount === 0) {
        // Don't log 404s or retries
      }
    } finally {
      this.processedGames++;
    }
    
    return stats;
  }
  
  private async parseTeamStats(teamData: any, game: any, teamId: number, homeAway: string): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      // Process all players
      for (const [playerId, playerData] of Object.entries(teamData.players || {})) {
        const player: any = playerData;
        
        // Get or create player
        const dbPlayerId = await this.getOrCreatePlayer(player, teamId, game.sport);
        if (!dbPlayerId) continue;
        
        const baseStats = {
          game_id: game.id,
          player_id: dbPlayerId,
          team_id: teamId,
          sport: game.sport,
          season: game.year,
          home_away: homeAway,
          data_source: 'mlb_api',
          confidence_score: 0.95
        };
        
        // Process batting stats
        if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
          const batting = player.stats.batting;
          stats.push({
            ...baseStats,
            position: player.position?.abbreviation || 'PH',
            played: true,
            started: player.gameStatus?.isSubstitute === false,
            stats: {
              // Standard batting stats
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
              caught_stealing: batting.caughtStealing || 0,
              hit_by_pitch: batting.hitByPitch || 0,
              sacrifice_hits: batting.sacBunts || 0,
              sacrifice_flies: batting.sacFlies || 0,
              ground_into_double_play: batting.groundIntoDoublePlay || 0,
              batting_average: batting.avg || batting.battingAverage || 0,
              on_base_percentage: batting.obp || batting.onBasePercentage || 0,
              slugging_percentage: batting.slg || batting.sluggingPercentage || 0,
              ops: batting.ops || 0,
              // Fielding if available
              putouts: batting.putOuts || 0,
              assists: batting.assists || 0,
              errors: batting.errors || 0
            }
          });
        }
        
        // Process pitching stats
        if (player.stats?.pitching && Object.keys(player.stats.pitching).length > 0) {
          const pitching = player.stats.pitching;
          stats.push({
            ...baseStats,
            position: player.position?.abbreviation || 'P',
            played: true,
            started: pitching.gamesStarted > 0,
            stats: {
              // Standard pitching stats
              innings_pitched: parseFloat(pitching.inningsPitched || '0'),
              hits_allowed: pitching.hits || 0,
              runs_allowed: pitching.runs || 0,
              earned_runs: pitching.earnedRuns || 0,
              walks_allowed: pitching.baseOnBalls || 0,
              strikeouts: pitching.strikeOuts || 0,
              home_runs_allowed: pitching.homeRuns || 0,
              hit_batsmen: pitching.hitBatsmen || 0,
              wild_pitches: pitching.wildPitches || 0,
              balks: pitching.balks || 0,
              wins: pitching.wins || 0,
              losses: pitching.losses || 0,
              saves: pitching.saves || 0,
              holds: pitching.holds || 0,
              blown_saves: pitching.blownSaves || 0,
              era: pitching.era || 0,
              whip: pitching.whip || 0,
              pitches_thrown: pitching.pitchesThrown || 0,
              strikes: pitching.strikes || 0,
              balls: pitching.balls || 0,
              batters_faced: pitching.battersFaced || 0,
              games_pitched: pitching.gamesPitched || 0,
              games_started: pitching.gamesStarted || 0,
              games_finished: pitching.gamesFinished || 0,
              complete_games: pitching.completeGames || 0,
              shutouts: pitching.shutouts || 0,
              quality_starts: pitching.qualityStarts || 0
            }
          });
        }
      }
    } catch (error) {
      // Skip team if parsing fails
    }
    
    return stats;
  }
  
  private async getOrCreatePlayer(player: any, teamId: number, sport: string): Promise<number | null> {
    if (!player.person?.id) return null;
    
    const mlbId = player.person.id.toString();
    const cacheKey = `mlb_${mlbId}`;
    
    // Check cache first
    if (this.playerCache.has(cacheKey)) {
      return this.playerCache.get(cacheKey)!;
    }
    
    try {
      // Insert or get player
      const result = await pgPool.query(
        `INSERT INTO players_master (
          our_player_id, sport, name, first_name, last_name,
          position, jersey_number, team_id, mlb_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (our_player_id) DO UPDATE 
        SET team_id = $8, position = $6, updated_at = NOW()
        RETURNING id`,
        [
          `milb_${mlbId}`,
          sport,
          player.person.fullName,
          player.person.firstName || '',
          player.person.lastName || '',
          player.position?.abbreviation || '',
          player.jerseyNumber || '',
          teamId,
          mlbId,
          player.person.active ? 'Active' : 'Inactive'
        ]
      );
      
      const playerId = result.rows[0].id;
      this.playerCache.set(cacheKey, playerId);
      return playerId;
      
    } catch (error) {
      return null;
    }
  }
  
  private async insertStats(stats: any[]) {
    if (stats.length === 0) return;
    
    await this.engine.bulkInsert('player_game_stats', stats, {
      conflictTarget: 'game_id, player_id',
      updateColumns: ['stats', 'played', 'started', 'position', 'updated_at'],
      batchSize: DB_BATCH_SIZE
    });
    
    this.totalStats += stats.length;
    console.log(chalk.gray(`    💾 Inserted ${stats.length.toLocaleString()} player stats`));
  }
  
  private async retryFailedGames() {
    const failedGames = await pgPool.query(`
      SELECT id, sport, mlb_game_id, game_date, home_team_id, away_team_id,
             EXTRACT(YEAR FROM game_date) as year
      FROM games_master
      WHERE mlb_game_id = ANY($1)
    `, [Array.from(this.failedGameIds)]);
    
    const allStats: any[] = [];
    const BATCH_SIZE = 200;
    
    for (let i = 0; i < failedGames.rows.length; i += BATCH_SIZE) {
      const batch = failedGames.rows.slice(i, i + BATCH_SIZE);
      const batchStats = await this.processBatch(batch);
      allStats.push(...batchStats);
      
      if (allStats.length >= DB_BATCH_SIZE) {
        await this.insertStats(allStats.splice(0, DB_BATCH_SIZE));
      }
    }
    
    if (allStats.length > 0) {
      await this.insertStats(allStats);
    }
  }
  
  private showProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSecond = this.processedGames / elapsed;
    const eta = (this.totalGames - this.processedGames) / gamesPerSecond;
    
    const percent = (this.processedGames / this.totalGames * 100).toFixed(1);
    const successRate = this.processedGames > 0 
      ? (this.successfulGames / this.processedGames * 100).toFixed(1)
      : '0.0';
    
    console.log(chalk.green(
      `    Progress: ${this.processedGames.toLocaleString()}/${this.totalGames.toLocaleString()} (${percent}%) | ` +
      `Success: ${successRate}% | ` +
      `Stats: ${this.totalStats.toLocaleString()} | ` +
      `Speed: ${gamesPerSecond.toFixed(1)} games/sec | ` +
      `ETA: ${(eta / 60).toFixed(1)} min`
    ));
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new MiLBStatsUltraCollector();
  collector.collect().catch(console.error);
}