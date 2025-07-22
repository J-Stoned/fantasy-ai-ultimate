#!/usr/bin/env tsx
/**
 * ⚾ NCAA BASEBALL STATS COLLECTOR - ULTRA OPTIMIZED
 * 
 * Collects detailed stats for all 6,344 NCAA Baseball games
 * Similar to MLB but with college-specific considerations
 */

import pgPool from '../pg-config';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 200; // 200 concurrent API calls for NCAA Baseball
const DB_BATCH_SIZE = 3000; // Insert 3000 stats at once

export class NCAABaseballStatsCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n⚾ NCAA BASEBALL STATS COLLECTOR - 6,344 GAMES\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 200 calls'));
    console.log(chalk.yellow('⚡ Expected time: 2-3 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all NCAA Baseball players first
      await this.cacheNCAABaseballPlayers();
      
      // Get all NCAA Baseball games needing stats
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
        WHERE g.sport = 'NCAA_BASEBALL'
        AND g.status = 'STATUS_FINAL'
        AND g.espn_game_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} NCAA Baseball games needing stats\n`));
      
      // Process games in batches of 200
      const BATCH_SIZE = 200;
      const allStats: any[] = [];
      
      for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
        const batch = games.rows.slice(i, i + BATCH_SIZE);
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(games.rows.length/BATCH_SIZE)}...`));
        
        // Process batch in parallel
        const batchStats = await this.processBatch(batch);
        allStats.push(...batchStats);
        
        // Insert stats every 3000 records
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
      console.log(chalk.green.bold(`\n✅ NCAA BASEBALL STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ NCAA Baseball stats collection failed:'), error);
    } finally {
      // Don't end pool - let master collector handle it
    }
  }
  
  private async cacheNCAABaseballPlayers() {
    console.log(chalk.cyan('📦 Caching NCAA Baseball players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, name
      FROM players_master
      WHERE sport = 'NCAA_BASEBALL'
    `);
    
    players.rows.forEach(player => {
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.espn_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} NCAA Baseball players\n`));
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Debug first game
      if (this.processedGames === 0) {
        console.log(`\nDEBUG - First game response:`);
        console.log(`Has boxscore: ${!!response.data.boxscore}`);
        console.log(`Has players: ${!!response.data.boxscore?.players}`);
        if (response.data.boxscore?.players) {
          console.log(`Teams: ${response.data.boxscore.players.length}`);
        }
      }
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = teamData.team.id === game.home_espn_id 
            ? game.home_team_id 
            : game.away_team_id;
          
          // Debug first team's structure
          if (this.processedGames === 0 && teamData === response.data.boxscore.players[0]) {
            console.log(`\nDEBUG - Team: ${teamData.team.displayName}`);
            console.log(`Statistics: ${teamData.statistics?.length || 0}`);
            if (teamData.statistics) {
              teamData.statistics.forEach((cat: any, i: number) => {
                console.log(`Category ${i}: ${cat.name || 'unnamed'}, athletes: ${cat.athletes?.length || 0}`);
                if (cat.athletes?.[0]) {
                  console.log(`  First player: ${cat.athletes[0].athlete?.displayName}, pos: ${cat.athletes[0].position?.abbreviation}`);
                  console.log(`  Stats length: ${cat.athletes[0].stats?.length}`);
                }
              });
            }
          }
          
          // Process batting and pitching stats separately
          // NCAA Baseball has unnamed categories, so we detect by position
          for (const category of teamData.statistics || []) {
            // Check first player's position to determine category type
            const firstPlayer = category.athletes?.[0];
            if (!firstPlayer) continue;
            
            const isPitching = firstPlayer.position?.abbreviation === 'P';
            const categoryType = isPitching ? 'pitching' : 'batting';
            
            for (const player of category.athletes || []) {
              const playerStats = await this.parsePlayerStats(
                player, 
                categoryType, 
                game, 
                teamId
              );
              if (playerStats) {
                stats.push(playerStats);
              }
            }
          }
        }
      }
      
      this.processedGames++;
      
      // Debug stats collection
      if (stats.length > 0 && this.totalStats === 0) {
        console.log(`DEBUG - First game collected ${stats.length} stats`);
      }
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.log(chalk.gray(`  Failed game ${game.id}: ${error.message}`));
      }
    }
    
    return stats;
  }
  
  private async parsePlayerStats(player: any, category: string, game: any, teamId: number): Promise<any> {
    try {
      // Get or create player
      const playerId = await this.getOrCreatePlayer(player, teamId);
      if (!playerId) return null;
      
      const stats: any = {};
      
      if (category === 'batting' && player.stats && player.stats.length >= 10) {
        // ESPN College Baseball batting stats order: AB, R, H, RBI, BB, K, AVG, OBP, SLG, ...
        const values = player.stats;
        
        Object.assign(stats, {
          at_bats: parseInt(values[0]) || 0,
          runs: parseInt(values[1]) || 0,
          hits: parseInt(values[2]) || 0,
          rbi: parseInt(values[3]) || 0,
          walks: parseInt(values[4]) || 0,
          strikeouts: parseInt(values[5]) || 0,
          batting_average: parseFloat(values[6]) || 0,
          on_base_percentage: parseFloat(values[7]) || 0,
          slugging_percentage: parseFloat(values[8]) || 0,
          // Additional stats if available
          doubles: parseInt(values[9]) || 0,
          triples: parseInt(values[10]) || 0,
          home_runs: parseInt(values[11]) || 0,
          stolen_bases: parseInt(values[12]) || 0,
          caught_stealing: parseInt(values[13]) || 0
        });
      } else if (category === 'pitching' && player.stats && player.stats.length >= 8) {
        // ESPN College Baseball pitching stats order: IP, H, R, ER, BB, K, ERA, ...
        const values = player.stats;
        
        Object.assign(stats, {
          innings_pitched: parseFloat(values[0]) || 0,
          hits_allowed: parseInt(values[1]) || 0,
          runs_allowed: parseInt(values[2]) || 0,
          earned_runs: parseInt(values[3]) || 0,
          walks_allowed: parseInt(values[4]) || 0,
          strikeouts: parseInt(values[5]) || 0,
          era: parseFloat(values[6]) || 0,
          // Additional stats if available
          whip: parseFloat(values[7]) || 0,
          wins: parseInt(values[8]) || 0,
          losses: parseInt(values[9]) || 0,
          saves: parseInt(values[10]) || 0,
          home_runs_allowed: parseInt(values[11]) || 0
        });
      }
      
      // Only return if we parsed some stats
      if (Object.keys(stats).length > 0) {
        return {
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          sport: 'NCAA_BASEBALL',
          season: game.season,
          position: player.position?.abbreviation || (category === 'pitching' ? 'P' : 'POS'),
          played: true,
          started: player.starter || false,
          stats: stats,
          data_source: 'espn_api',
          confidence_score: 0.95
        };
      }
    } catch (error) {
      // Skip this player
    }
    
    return null;
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
          `ncaa_baseball_${player.athlete.id}`,
          'NCAA_BASEBALL',
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
  const collector = new NCAABaseballStatsCollector();
  collector.collect().catch(console.error);
}