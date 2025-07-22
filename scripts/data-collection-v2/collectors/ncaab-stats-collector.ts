#!/usr/bin/env tsx
/**
 * 🏀 NCAA BASKETBALL STATS COLLECTOR - ULTRA OPTIMIZED
 * 
 * Collects detailed stats for all 2,931 NCAAB games
 * Similar to NBA but with college-specific considerations
 */

import pgPool from '../pg-config';
import axios from 'axios';
import chalk from 'chalk';
import pLimit from 'p-limit';
import { ParallelCollectionEngine } from '../phase2-parallel-engine';

const API_CONCURRENCY = 150; // 150 concurrent API calls for NCAAB
const DB_BATCH_SIZE = 1500; // Insert 1500 stats at once

export class NCAABStatsCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.blue.bold('\n🏀 NCAA BASKETBALL STATS COLLECTOR - 2,931 GAMES\n'));
    console.log(chalk.yellow('⚡ API Concurrency: 150 calls'));
    console.log(chalk.yellow('⚡ Expected time: 1-2 minutes\n'));
  }
  
  async collect() {
    try {
      // Cache all NCAAB players first
      await this.cacheNCAABPlayers();
      
      // Get all NCAAB games needing stats
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
        WHERE g.sport = 'NCAAB'
        AND g.status = 'STATUS_FINAL'
        AND g.espn_game_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} NCAAB games needing stats\n`));
      
      // Process games in batches of 150
      const BATCH_SIZE = 150;
      const allStats: any[] = [];
      
      for (let i = 0; i < games.rows.length; i += BATCH_SIZE) {
        const batch = games.rows.slice(i, i + BATCH_SIZE);
        console.log(chalk.yellow(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(games.rows.length/BATCH_SIZE)}...`));
        
        // Process batch in parallel
        const batchStats = await this.processBatch(batch);
        allStats.push(...batchStats);
        
        // Insert stats every 1500 records
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
      console.log(chalk.green.bold(`\n✅ NCAAB STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ NCAAB stats collection failed:'), error);
    } finally {
      // Don't end pool - let master collector handle it
    }
  }
  
  private async cacheNCAABPlayers() {
    console.log(chalk.cyan('📦 Caching NCAAB players...'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, name
      FROM players_master
      WHERE sport = 'NCAAB'
    `);
    
    players.rows.forEach(player => {
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.espn_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} NCAAB players\n`));
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${game.espn_game_id}`;
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
          
          // NCAAB has all stats in one category like NBA
          const players = teamData.statistics?.[0]?.athletes || [];
          
          for (const player of players) {
            const playerStats = await this.parsePlayerStats(player, game, teamId);
            if (playerStats) {
              stats.push(playerStats);
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
  
  private async parsePlayerStats(player: any, game: any, teamId: number): Promise<any> {
    try {
      // Skip if no stats or DNP
      // NCAAB has 13 stats (no +/- like NBA)
      if (!player.stats || player.stats.length < 13) {
        return null;
      }
      
      // Get or create player
      const playerId = await this.getOrCreatePlayer(player, teamId);
      if (!playerId) return null;
      
      // ESPN NCAAB stats order: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, PTS (no +/-)
      const values = player.stats;
      
      // Parse minutes (can be "DNP-COACH'S DECISION" etc)
      const minutesStr = values[0];
      const minutes = minutesStr === '--' || minutesStr.includes('DNP') ? 0 : parseInt(minutesStr);
      
      // Skip if didn't play - points is at index 12 (not 13)
      const points = parseInt(values[12]) || 0;
      if (minutes === 0 && points === 0) {
        return null;
      }
      
      // Parse shooting stats
      const [fgMade, fgAtt] = (values[1] || '0-0').split('-').map(Number);
      const [threeMade, threeAtt] = (values[2] || '0-0').split('-').map(Number);
      const [ftMade, ftAtt] = (values[3] || '0-0').split('-').map(Number);
      
      const stats = {
        minutes: minutes,
        field_goals_made: fgMade || 0,
        field_goals_attempted: fgAtt || 0,
        field_goal_percentage: fgAtt > 0 ? (fgMade / fgAtt) : 0,
        three_pointers_made: threeMade || 0,
        three_pointers_attempted: threeAtt || 0,
        three_point_percentage: threeAtt > 0 ? (threeMade / threeAtt) : 0,
        free_throws_made: ftMade || 0,
        free_throws_attempted: ftAtt || 0,
        free_throw_percentage: ftAtt > 0 ? (ftMade / ftAtt) : 0,
        offensive_rebounds: parseInt(values[4]) || 0,
        defensive_rebounds: parseInt(values[5]) || 0,
        rebounds: parseInt(values[6]) || 0,
        assists: parseInt(values[7]) || 0,
        steals: parseInt(values[8]) || 0,
        blocks: parseInt(values[9]) || 0,
        turnovers: parseInt(values[10]) || 0,
        personal_fouls: parseInt(values[11]) || 0,
        plus_minus: 0, // NCAAB doesn't have +/- in API
        points: parseInt(values[12]) || 0
      };
      
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NCAAB',
        season: game.season,
        position: player.position?.abbreviation || 'UNK',
        played: true,
        started: player.starter || false,
        minutes_played: minutes,
        stats: stats,
        data_source: 'espn_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      // Skip this player
      return null;
    }
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
          `ncaab_${player.athlete.id}`,
          'NCAAB',
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
      updateColumns: ['stats', 'played', 'started', 'position', 'minutes_played', 'updated_at'],
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
  const collector = new NCAABStatsCollector();
  collector.collect().catch(console.error);
}