#!/usr/bin/env tsx
/**
 * 🏒 NHL SKATER STATS COLLECTOR
 * 
 * Collects missing skater stats for NHL games
 * Fixes the issue where only goalie stats were collected
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

const API_CONCURRENCY = 100;
const DB_BATCH_SIZE = 2000;

class NHLSkaterCollector {
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private playerCache = new Map<string, number>();
  
  async collect() {
    console.log(chalk.cyan.bold('\n🏒 NHL SKATER STATS COLLECTOR\n'));
    console.log(chalk.yellow('⚡ Collecting missing forward and defense stats'));
    
    try {
      // Cache all NHL players first
      await this.cacheNHLPlayers();
      
      // Get all NHL games - we need to re-process them for skater stats
      const games = await pool.query(`
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
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`Found ${this.totalGames} NHL games to process\n`));
      
      // Process games in batches
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
      console.log(chalk.green.bold(`\n✅ NHL SKATER STATS COLLECTION COMPLETE!`));
      console.log(chalk.yellow(`⏱️  Time: ${totalTime.toFixed(1)}s`));
      console.log(chalk.yellow(`📊 Games: ${this.processedGames}`));
      console.log(chalk.yellow(`📈 Stats: ${this.totalStats.toLocaleString()}`));
      console.log(chalk.yellow(`⚡ Speed: ${(this.processedGames / totalTime).toFixed(1)} games/sec\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ NHL skater stats collection failed:'), error);
    } finally {
      await pool.end();
    }
  }
  
  private async cacheNHLPlayers() {
    const players = await pool.query(`
      SELECT id, espn_id FROM players_master 
      WHERE sport = 'NHL' 
      AND espn_id IS NOT NULL
    `);
    
    players.rows.forEach(p => {
      if (p.espn_id) {
        this.playerCache.set(p.espn_id.toString(), p.id);
      }
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length} NHL players`));
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
          
          // Process skaters only (forwards and defenses)
          for (const category of teamData.statistics || []) {
            if (category.name === 'forwards' || category.name === 'defenses') {
              for (const player of category.athletes || []) {
                const playerStats = await this.parseSkaterStats(player, game, teamId, category);
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
        console.log(chalk.gray(`  Failed game ${game.id}: ${error.message}`));
      }
    }
    
    return stats;
  }
  
  private async parseSkaterStats(player: any, game: any, teamId: number, category: any): Promise<any> {
    try {
      // Skip if no stats
      if (!player.stats || player.stats.length < 21) return null;
      
      // Get or create player
      const playerId = await this.getOrCreatePlayer(player, teamId);
      if (!playerId) return null;
      
      // Map stats based on the keys from the API
      const values = player.stats;
      const keys = category.keys;
      
      // Build stats object dynamically
      const stats: any = {};
      keys.forEach((key: string, index: number) => {
        const value = values[index];
        
        // Map API keys to our database fields
        switch(key) {
          case 'goals': stats.goals = parseInt(value) || 0; break;
          case 'assists': stats.assists = parseInt(value) || 0; break;
          case 'shotsTotal': stats.shots = parseInt(value) || 0; break;
          case 'blockedShots': stats.blocks = parseInt(value) || 0; break;
          case 'hits': stats.hits = parseInt(value) || 0; break;
          case 'plusMinus': stats.plus_minus = parseInt(value) || 0; break;
          case 'penaltyMinutes': stats.pim = parseInt(value) || 0; break;
          case 'timeOnIce': stats.time_on_ice = value || '0:00'; break;
          case 'powerPlayTimeOnIce': stats.pp_toi = value || '0:00'; break;
          case 'shortHandedTimeOnIce': stats.sh_toi = value || '0:00'; break;
          case 'faceoffsWon': stats.faceoff_wins = parseInt(value) || 0; break;
          case 'faceoffsLost': stats.faceoff_losses = parseInt(value) || 0; break;
          case 'takeaways': stats.takeaways = parseInt(value) || 0; break;
          case 'giveaways': stats.giveaways = parseInt(value) || 0; break;
          case 'shootoutGoals': stats.shootout_goals = parseInt(value) || 0; break;
          case 'shifts': stats.shifts = parseInt(value) || 0; break;
        }
      });
      
      // Calculate points
      stats.points = stats.goals + stats.assists;
      
      // Calculate shooting percentage
      if (stats.shots > 0 && stats.goals > 0) {
        stats.shooting_percentage = (stats.goals / stats.shots * 100).toFixed(1);
      } else {
        stats.shooting_percentage = 0;
      }
      
      return {
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        sport: 'NHL',
        season: game.season,
        position: player.athlete?.position?.abbreviation || (category.name === 'forwards' ? 'F' : 'D'),
        played: true,
        started: player.starter || false,
        stats: stats,
        opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
        data_source: 'espn_api',
        confidence_score: 0.95
      };
      
    } catch (error) {
      return null;
    }
  }
  
  private async getOrCreatePlayer(playerData: any, teamId: number): Promise<number | null> {
    try {
      const espnId = playerData.athlete?.id;
      if (!espnId) return null;
      
      // Check cache first
      if (this.playerCache.has(espnId.toString())) {
        return this.playerCache.get(espnId.toString())!;
      }
      
      // Create new player
      const result = await pool.query(`
        INSERT INTO players_master (
          name, 
          sport, 
          team_id, 
          position, 
          espn_id,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (espn_id) 
        DO UPDATE SET 
          team_id = EXCLUDED.team_id,
          position = EXCLUDED.position,
          updated_at = NOW()
        RETURNING id
      `, [
        playerData.athlete.displayName,
        'NHL',
        teamId,
        playerData.athlete.position?.abbreviation || 'F',
        parseInt(espnId),
        'active'
      ]);
      
      const playerId = result.rows[0].id;
      this.playerCache.set(espnId.toString(), playerId);
      return playerId;
      
    } catch (error) {
      return null;
    }
  }
  
  private async insertStats(stats: any[]) {
    if (stats.length === 0) return;
    
    // Build values array
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    stats.forEach(stat => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        stat.game_id,
        stat.player_id,
        stat.team_id,
        stat.opponent_id,
        stat.sport,
        stat.season,
        stat.position,
        stat.played,
        stat.started,
        stat.stats,
        stat.data_source,
        stat.confidence_score
      );
    });
    
    const query = `
      INSERT INTO player_game_stats (
        game_id, player_id, team_id, opponent_id, sport, season,
        position, played, started, stats, data_source, confidence_score
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (game_id, player_id) 
      DO UPDATE SET 
        stats = EXCLUDED.stats,
        position = EXCLUDED.position,
        updated_at = NOW()
    `;
    
    await pool.query(query, values);
    this.totalStats += stats.length;
  }
  
  private showProgress() {
    const percent = (this.processedGames / this.totalGames * 100).toFixed(1);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.processedGames / elapsed;
    const eta = (this.totalGames - this.processedGames) / rate;
    
    process.stdout.write(`\r  Progress: ${this.processedGames}/${this.totalGames} (${percent}%) | Speed: ${rate.toFixed(1)} games/s | ETA: ${(eta / 60).toFixed(1)} min`);
  }
}

// Run the collector
const collector = new NHLSkaterCollector();
collector.collect().catch(console.error);