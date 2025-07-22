#!/usr/bin/env tsx
/**
 * ⚾ MiLB STATS COLLECTOR - ULTRA OPTIMIZED
 * 
 * Collects detailed stats for all 75,331 MiLB games
 * Uses MiLB.com API for comprehensive minor league data
 */

import pgPool from '../pg-config';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 100; // 100 concurrent API calls for MiLB
const DB_BATCH_SIZE = 3000; // Insert 3000 stats at once

export class MiLBStatsCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n⚾ MiLB STATS COLLECTOR - 75,331 GAMES\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 100 calls'));
    console.log(chalk.yellow('⚡ Expected time: 10-15 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all MiLB players first
      await this.cacheMiLBPlayers();
      
      // Get all MiLB games needing stats
      const games = await pgPool.query(`
        SELECT 
          g.*,
          ht.espn_id as home_espn_id,
          ht.name as home_team_name,
          ht.milb_id as home_milb_id,
          at.espn_id as away_espn_id,
          at.name as away_team_name,
          at.milb_id as away_milb_id
        FROM games_master g
        JOIN teams_master ht ON g.home_team_id = ht.id
        JOIN teams_master at ON g.away_team_id = at.id
        WHERE g.sport = 'MiLB'
        AND g.status = 'STATUS_FINAL'
        AND g.milb_game_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} MiLB games needing stats\n`));
      
      // Process games in batches
      const BATCH_SIZE = 100;
      const allStats: any[] = [];
      
      for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
        const batch = games.rows.slice(i, i + BATCH_SIZE);
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(games.rows.length/BATCH_SIZE)}...`));
        
        // Process batch in parallel
        const batchStats = await this.processBatch(batch);
        allStats.push(...batchStats);
        
        // Insert stats every DB_BATCH_SIZE records
        if (allStats.length >= DB_BATCH_SIZE) {
          await this.insertStats(allStats.splice(0, DB_BATCH_SIZE));
        }
        
        this.showProgress();
      }
      
      // Insert remaining stats
      if (allStats.length > 0) {
        await this.insertStats(allStats);
      }
      
      const totalTime = (Date.now() - this.startTime) / 1000;
      console.log(chalk.green.bold(`\n✅ MiLB STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ MiLB stats collection failed:'), error);
    } finally {
      // Don't end pool - let master collector handle it
    }
  }
  
  private async cacheMiLBPlayers() {
    console.log(chalk.cyan('📦 Caching MiLB players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, milb_id, name
      FROM players_master
      WHERE sport = 'MiLB'
    `);
    
    players.rows.forEach(player => {
      if (player.milb_id) {
        this.playerCache.set(`milb_${player.milb_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} MiLB players\n`));
  }
  
  private async processBatch(games: any[]): Promise<any[]> {
    const promises = games.map(game => 
      this.apiLimit(() => this.collectGameStats(game))
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  private async collectGameStats(game: any): Promise<any[]> {
    const stats: any[] = [];
    
    try {
      // MiLB.com API endpoint
      const url = `https://statsapi.mlb.com/api/v1.1/game/${game.milb_game_id}/boxscore`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data.teams) {
        // Process home and away teams
        for (const side of ['home', 'away']) {
          const teamData = response.data.teams[side];
          const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
          
          // Process batters
          if (teamData.players) {
            for (const playerId in teamData.players) {
              const player = teamData.players[playerId];
              
              if (player.stats?.batting && player.gameStatus?.isCurrentBatter !== undefined) {
                const playerStats = await this.parseBatterStats(player, playerId, game, teamId);
                if (playerStats) {
                  stats.push(playerStats);
                }
              }
              
              // Process pitchers
              if (player.stats?.pitching && player.gameStatus?.isCurrentPitcher !== undefined) {
                const playerStats = await this.parsePitcherStats(player, playerId, game, teamId);
                if (playerStats) {
                  stats.push(playerStats);
                }
              }
            }
          }
        }
      }
      
      this.processedGames++;
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        // Silently skip 404s (game data not available)
        if (this.processedGames % 100 === 0) {
          console.log(chalk.gray(`  Failed game ${game.id}: ${error.message}`));
        }
      }
    }
    
    return stats;
  }
  
  private async parseBatterStats(player: any, playerId: string, game: any, teamId: number): Promise<any> {
    try {
      const batting = player.stats.batting;
      
      // Skip if didn't play
      if (!batting || (batting.atBats === 0 && batting.plateAppearances === 0)) {
        return null;
      }
      
      // Get or create player
      const dbPlayerId = await this.getOrCreatePlayer(player, playerId, teamId);
      if (!dbPlayerId) return null;
      
      const stats = {
        // Batting stats
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
        batting_average: batting.avg || batting.atBats > 0 ? (batting.hits / batting.atBats).toFixed(3) : '.000',
        on_base_percentage: batting.obp || '.000',
        slugging_percentage: batting.slg || '.000',
        ops: batting.ops || 0,
        total_bases: batting.totalBases || 0,
        hit_by_pitch: batting.hitByPitch || 0,
        sacrifice_flies: batting.sacFlies || 0,
        sacrifice_bunts: batting.sacBunts || 0,
        ground_into_double_play: batting.groundIntoDoublePlay || 0,
        left_on_base: batting.leftOnBase || 0,
        plate_appearances: batting.plateAppearances || 0
      };
      
      return {
        player_id: dbPlayerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'MiLB',
        season: game.season,
        position: player.position?.abbreviation || 'DH',
        played: true,
        started: player.gameStatus?.isSubstitute === false,
        stats: stats,
        data_source: 'milb_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private async parsePitcherStats(player: any, playerId: string, game: any, teamId: number): Promise<any> {
    try {
      const pitching = player.stats.pitching;
      
      // Skip if didn't pitch
      if (!pitching || pitching.inningsPitched === '0.0') {
        return null;
      }
      
      // Get or create player
      const dbPlayerId = await this.getOrCreatePlayer(player, playerId, teamId);
      if (!dbPlayerId) return null;
      
      const stats = {
        // Pitching stats
        wins: pitching.wins || 0,
        losses: pitching.losses || 0,
        saves: pitching.saves || 0,
        holds: pitching.holds || 0,
        blown_saves: pitching.blownSaves || 0,
        innings_pitched: pitching.inningsPitched || '0.0',
        hits_allowed: pitching.hits || 0,
        runs_allowed: pitching.runs || 0,
        earned_runs: pitching.earnedRuns || 0,
        home_runs_allowed: pitching.homeRuns || 0,
        walks_allowed: pitching.baseOnBalls || 0,
        strikeouts: pitching.strikeOuts || 0,
        hit_batters: pitching.hitBatsmen || 0,
        wild_pitches: pitching.wildPitches || 0,
        era: pitching.era || '0.00',
        whip: pitching.whip || '0.00',
        pitches_thrown: pitching.numberOfPitches || 0,
        strikes_thrown: pitching.strikes || 0,
        balls_thrown: pitching.balls || 0,
        batters_faced: pitching.battersFaced || 0,
        outs_recorded: pitching.outs || 0,
        ground_outs: pitching.groundOuts || 0,
        fly_outs: pitching.airOuts || 0,
        inherited_runners: pitching.inheritedRunners || 0,
        inherited_runners_scored: pitching.inheritedRunnersScored || 0,
        pitch_count: pitching.pitchesThrown || 0,
        game_score: pitching.gameScore || 0
      };
      
      return {
        player_id: dbPlayerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'MiLB',
        season: game.season,
        position: 'P',
        played: true,
        started: player.gameStatus?.isStartingPitcher || false,
        stats: stats,
        data_source: 'milb_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private async getOrCreatePlayer(player: any, milbId: string, teamId: number): Promise<number | null> {
    if (!milbId) return null;
    
    // Check cache first
    const cacheKey = `milb_${milbId}`;
    if (this.playerCache.has(cacheKey)) {
      return this.playerCache.get(cacheKey)!;
    }
    
    try {
      // Insert or get player
      const result = await pgPool.query(
        `INSERT INTO players_master (
          our_player_id, sport, name, first_name, last_name,
          position, jersey_number, team_id, milb_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (our_player_id) DO UPDATE 
        SET team_id = $8, position = $6, updated_at = NOW()
        RETURNING id`,
        [
          `milb_${milbId}`,
          'MiLB',
          player.person?.fullName || '',
          player.person?.firstName || '',
          player.person?.lastName || '',
          player.position?.abbreviation || '',
          player.jerseyNumber || '',
          teamId,
          milbId,
          'Active'
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
    console.log(chalk.gray(`  💾 Inserted ${stats.length} player stats`));
  }
  
  private showProgress() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSecond = this.processedGames / elapsed;
    const eta = (this.totalGames - this.processedGames) / gamesPerSecond;
    
    console.log(chalk.green(
      `  Progress: ${this.processedGames}/${this.totalGames} games | ` +
      `${this.totalStats.toLocaleString()} stats | ` +
      `${gamesPerSecond.toFixed(1)} games/sec | ` +
      `ETA: ${eta.toFixed(0)}s`
    ));
  }
}

// Run if called directly
if (require.main === module) {
  const collector = new MiLBStatsCollector();
  collector.collect().catch(console.error);
}