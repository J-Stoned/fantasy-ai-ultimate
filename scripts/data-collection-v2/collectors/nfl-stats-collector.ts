#!/usr/bin/env tsx
/**
 * 🏈 NFL STATS COLLECTOR - ULTRA OPTIMIZED
 * 
 * Collects detailed stats for all 1,408 NFL games
 * - Passing: completions, attempts, yards, TDs, INTs, rating
 * - Rushing: attempts, yards, TDs, long, fumbles
 * - Receiving: targets, receptions, yards, TDs, long
 * - Defense: tackles, sacks, INTs, forced fumbles
 * - Kicking: FG made/att, XP made/att, points
 */

import pgPool from '../pg-config';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 100; // 100 concurrent API calls for NFL
const DB_BATCH_SIZE = 1000; // Insert 1000 stats at once

export class NFLStatsCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.blue.bold('\n🏈 NFL STATS COLLECTOR - 1,408 GAMES\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 100 calls'));
    console.log(chalk.yellow('⚡ Expected time: 2-3 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all NFL players first
      await this.cacheNFLPlayers();
      
      // Get all NFL games needing stats
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
        WHERE g.sport = 'NFL'
        AND g.status = 'STATUS_FINAL'
        AND g.espn_game_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} NFL games needing stats\n`));
      
      // Process games in batches of 100
      const BATCH_SIZE = 100;
      const allStats: any[] = [];
      
      for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
        const batch = games.rows.slice(i, i + BATCH_SIZE);
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(games.rows.length/BATCH_SIZE)}...`));
        
        // Process batch in parallel
        const batchStats = await this.processBatch(batch);
        allStats.push(...batchStats);
        
        // Insert stats every 1000 records
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
      console.log(chalk.green.bold(`\n✅ NFL STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ NFL stats collection failed:'), error);
    } finally {
      // Don't end pool - let master collector handle it
    }
  }
  
  private async cacheNFLPlayers() {
    console.log(chalk.cyan('📦 Caching NFL players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, name
      FROM players_master
      WHERE sport = 'NFL'
    `);
    
    players.rows.forEach(player => {
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.espn_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} NFL players\n`));
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.espn_game_id}`;
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
          
          // Process each stat category
          for (const category of teamData.statistics || []) {
            for (const player of category.athletes || []) {
              const playerStats = await this.parsePlayerStats(
                player, 
                category.name, 
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
      const position = player.position?.abbreviation || 'UNK';
      
      // Parse based on stat category
      switch (category) {
        case 'passing':
          if (player.stats && player.stats.length >= 7) {
            const [compAtt, yards, td, int, sacks, qbr, rating] = player.stats;
            const [completions, attempts] = (compAtt || '0/0').split('/').map(Number);
            
            Object.assign(stats, {
              completions,
              attempts,
              passing_yards: parseInt(yards) || 0,
              passing_touchdowns: parseInt(td) || 0,
              interceptions: parseInt(int) || 0,
              sacks_taken: parseInt(sacks?.split('-')[0]) || 0,
              sack_yards: parseInt(sacks?.split('-')[1]) || 0,
              qbr: parseFloat(qbr) || 0,
              passer_rating: parseFloat(rating) || 0
            });
          }
          break;
          
        case 'rushing':
          if (player.stats && player.stats.length >= 5) {
            const [car, yards, avg, td, long] = player.stats;
            
            Object.assign(stats, {
              rushing_attempts: parseInt(car) || 0,
              rushing_yards: parseInt(yards) || 0,
              yards_per_carry: parseFloat(avg) || 0,
              rushing_touchdowns: parseInt(td) || 0,
              longest_rush: parseInt(long) || 0
            });
          }
          break;
          
        case 'receiving':
          if (player.stats && player.stats.length >= 6) {
            const [rec, yards, avg, td, long, tgts] = player.stats;
            
            Object.assign(stats, {
              targets: parseInt(tgts) || 0,
              receptions: parseInt(rec) || 0,
              receiving_yards: parseInt(yards) || 0,
              yards_per_reception: parseFloat(avg) || 0,
              receiving_touchdowns: parseInt(td) || 0,
              longest_reception: parseInt(long) || 0
            });
          }
          break;
          
        case 'defensive':
          if (player.stats && player.stats.length >= 6) {
            const [tot, solo, sacks, tloss, pd, qbhits] = player.stats;
            
            Object.assign(stats, {
              total_tackles: parseFloat(tot) || 0,
              solo_tackles: parseFloat(solo) || 0,
              sacks: parseFloat(sacks) || 0,
              tackles_for_loss: parseFloat(tloss) || 0,
              passes_defended: parseInt(pd) || 0,
              qb_hits: parseInt(qbhits) || 0
            });
          }
          break;
          
        case 'kicking':
          if (player.stats && player.stats.length >= 5) {
            const [fgMade, fgAtt, xpMade, xpAtt, pts] = player.stats;
            
            Object.assign(stats, {
              field_goals_made: parseInt(fgMade) || 0,
              field_goals_attempted: parseInt(fgAtt) || 0,
              extra_points_made: parseInt(xpMade) || 0,
              extra_points_attempted: parseInt(xpAtt) || 0,
              kicking_points: parseInt(pts) || 0
            });
          }
          break;
      }
      
      // Only return if we parsed some stats
      if (Object.keys(stats).length > 0) {
        return {
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          sport: 'NFL',
          season: game.season,
          position: position,
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
          `nfl_${player.athlete.id}`,
          'NFL',
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
  const collector = new NFLStatsCollector();
  collector.collect().catch(console.error);
}