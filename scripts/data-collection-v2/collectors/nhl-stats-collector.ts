#!/usr/bin/env tsx
/**
 * 🏒 NHL STATS COLLECTOR - ULTRA OPTIMIZED
 * 
 * Collects detailed stats for all 6,591 NHL games
 * - Skaters: G, A, P, +/-, PIM, PPG, PPA, SHG, SHA, GWG, S, S%, TOI
 * - Goalies: GA, SA, SV, SV%, W, L, OT, SO, MIN
 */

import pgPool from '../pg-config';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 200; // 200 concurrent API calls for NHL
const DB_BATCH_SIZE = 2000; // Insert 2000 stats at once

export class NHLStatsCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.cyan.bold('\n🏒 NHL STATS COLLECTOR - 6,591 GAMES\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 200 calls'));
    console.log(chalk.yellow('⚡ Expected time: 2-3 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all NHL players first
      await this.cacheNHLPlayers();
      
      // Get all NHL games needing stats
      const games = await pgPool.query(`
        SELECT 
          g.*,
          ht.espn_id as home_espn_id,
          ht.name as home_team_name,
          at.espn_id as away_espn_id,
          at.name as away_team_name
        FROM games_master g
        JOIN teams_master ht ON g.home_team_id = ht.id
        JOIN teams_master at ON g.away_team_id = at.id
        WHERE g.sport = 'NHL'
        AND g.status = 'STATUS_FINAL'
        AND g.espn_game_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} NHL games needing stats\n`));
      
      // Process games in batches of 200
      const BATCH_SIZE = 200;
      const allStats: any[] = [];
      
      for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
        const batch = games.rows.slice(i, i + BATCH_SIZE);
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(games.rows.length/BATCH_SIZE)}...`));
        
        // Process batch in parallel
        const batchStats = await this.processBatch(batch);
        allStats.push(...batchStats);
        
        // Insert stats every 2000 records
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
      console.log(chalk.green.bold(`\n✅ NHL STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ NHL stats collection failed:'), error);
    } finally {
      // Don't end pool - let master collector handle it
    }
  }
  
  private async cacheNHLPlayers() {
    console.log(chalk.cyan('📦 Caching NHL players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, name
      FROM players_master
      WHERE sport = 'NHL'
    `);
    
    players.rows.forEach(player => {
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.espn_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} NHL players\n`));
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = teamData.team.id === game.home_espn_id 
            ? game.home_team_id 
            : game.away_team_id;
          
          // Process skaters and goalies separately
          for (const category of teamData.statistics || []) {
            for (const player of category.athletes || []) {
              let playerStats;
              
              if (category.name === 'skaters') {
                playerStats = await this.parseSkaterStats(player, game, teamId);
              } else if (category.name === 'goalies') {
                playerStats = await this.parseGoalieStats(player, game, teamId);
              }
              
              if (playerStats) {
                stats.push(playerStats);
              }
            }
          }
        }
      }
      
      this.processedGames++;
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.log(chalk.gray(`  Failed game ${game.id}: ${error.message}`));
      }
    }
    
    return stats;
  }
  
  private async parseSkaterStats(player: any, game: any, teamId: number): Promise<any> {
    try {
      // Skip if no stats
      if (!player.stats || player.stats.length < 8) return null;
      
      // Get or create player
      const playerId = await this.getOrCreatePlayer(player, teamId);
      if (!playerId) return null;
      
      // ESPN NHL Skater stats order: G, A, P, +/-, PIM, PPG, SHG, SOG, TOI
      const values = player.stats;
      
      const stats = {
        goals: parseInt(values[0]) || 0,
        assists: parseInt(values[1]) || 0,
        points: parseInt(values[2]) || 0,
        plus_minus: parseInt(values[3]) || 0,
        penalty_minutes: parseInt(values[4]) || 0,
        power_play_goals: parseInt(values[5]) || 0,
        short_handed_goals: parseInt(values[6]) || 0,
        shots_on_goal: parseInt(values[7]) || 0,
        time_on_ice: values[8] || '0:00',
        
        // Additional calculated stats
        shooting_percentage: values[7] > 0 && values[0] > 0 
          ? (parseInt(values[0]) / parseInt(values[7]) * 100) 
          : 0,
        
        // Fantasy relevant
        hits: player.additionalStats?.hits || 0,
        blocked_shots: player.additionalStats?.blocks || 0,
        takeaways: player.additionalStats?.takeaways || 0,
        giveaways: player.additionalStats?.giveaways || 0,
        faceoff_wins: player.additionalStats?.faceoffWins || 0,
        faceoff_losses: player.additionalStats?.faceoffLosses || 0
      };
      
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NHL',
        season: game.season,
        position: player.position?.abbreviation || 'F',
        played: true,
        started: player.starter || false,
        stats: stats,
        data_source: 'espn_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private async parseGoalieStats(player: any, game: any, teamId: number): Promise<any> {
    try {
      // Skip if no stats
      if (!player.stats || player.stats.length < 6) return null;
      
      // Get or create player
      const playerId = await this.getOrCreatePlayer(player, teamId);
      if (!playerId) return null;
      
      // ESPN NHL Goalie stats order: MIN, GA, SA, SV, SV%, W-L-OT
      const values = player.stats;
      
      // Parse W-L-OT record
      const record = values[5] || '0-0-0';
      const [wins, losses, ot] = record.split('-').map(Number);
      
      const stats = {
        minutes_played: values[0] || '0:00',
        goals_against: parseInt(values[1]) || 0,
        shots_against: parseInt(values[2]) || 0,
        saves: parseInt(values[3]) || 0,
        save_percentage: parseFloat(values[4]) || 0,
        wins: wins || 0,
        losses: losses || 0,
        overtime_losses: ot || 0,
        
        // Calculate GAA (Goals Against Average)
        goals_against_average: values[0] && values[1] 
          ? (parseInt(values[1]) * 60 / this.parseMinutes(values[0])) 
          : 0,
          
        // Additional stats
        shutout: parseInt(values[1]) === 0 ? 1 : 0,
        penalty_minutes: player.additionalStats?.penaltyMinutes || 0,
        goals: player.additionalStats?.goals || 0,
        assists: player.additionalStats?.assists || 0
      };
      
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NHL',
        season: game.season,
        position: 'G',
        played: true,
        started: player.starter || false,
        stats: stats,
        data_source: 'espn_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private parseMinutes(timeStr: string): number {
    // Convert "MM:SS" to total minutes
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes + (seconds / 60);
  }
  
  private async getOrCreatePlayer(player: any, teamId: number): Promise<number | null> {
    if (!player.athlete?.id) return null;
    
    // Check cache first
    const cacheKey = `espn_${player.athlete.id}`;
    if (this.playerCache.has(cacheKey)) {
      return this.playerCache.get(cacheKey)!;
    }
    
    try {
      // Insert or get player
      const result = await pgPool.query(
        `INSERT INTO players_master (
          our_player_id, sport, name, first_name, last_name,
          position, jersey_number, team_id, espn_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (our_player_id) DO UPDATE 
        SET team_id = $8, position = $6, updated_at = NOW()
        RETURNING id`,
        [
          `nhl_${player.athlete.id}`,
          'NHL',
          player.athlete.displayName,
          player.athlete.firstName || '',
          player.athlete.lastName || '',
          player.position?.abbreviation || '',
          player.athlete.jersey || '',
          teamId,
          player.athlete.id,
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
  const collector = new NHLStatsCollector();
  collector.collect().catch(console.error);
}