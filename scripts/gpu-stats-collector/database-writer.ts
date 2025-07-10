#!/usr/bin/env tsx
/**
 * 🚀 DATABASE BULK WRITER
 * Optimized bulk insert operations for maximum performance
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export class DatabaseWriter {
  private supabase: SupabaseClient;
  private stats = {
    playerStatsInserted: 0,
    gameLogsInserted: 0,
    playersUpdated: 0,
    errors: 0,
    totalTime: 0
  };
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  /**
   * Bulk insert player stats
   */
  async bulkInsertPlayerStats(stats: any[], chunkSize = 1000): Promise<void> {
    console.log(chalk.cyan(`📝 Inserting ${stats.length} player stats...`));
    
    const startTime = Date.now();
    let inserted = 0;
    
    // Process in chunks to avoid memory issues
    for (let i = 0; i < stats.length; i += chunkSize) {
      const chunk = stats.slice(i, i + chunkSize);
      
      try {
        const { error, count } = await this.supabase
          .from('player_stats')
          .insert(chunk);
        
        if (error) {
          console.error(chalk.red(`Error inserting chunk: ${error.message}`));
          this.stats.errors++;
        } else {
          inserted += chunk.length;
          process.stdout.write(chalk.green('.'));
        }
      } catch (error: any) {
        console.error(chalk.red(`Chunk failed: ${error.message}`));
        this.stats.errors++;
      }
    }
    
    this.stats.playerStatsInserted += inserted;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✓ Inserted ${inserted} player stats in ${duration}s`));
  }
  
  /**
   * Bulk insert game logs
   */
  async bulkInsertGameLogs(logs: any[], chunkSize = 500): Promise<void> {
    console.log(chalk.cyan(`📝 Inserting ${logs.length} game logs...`));
    
    const startTime = Date.now();
    let inserted = 0;
    
    for (let i = 0; i < logs.length; i += chunkSize) {
      const chunk = logs.slice(i, i + chunkSize);
      
      try {
        const { error } = await this.supabase
          .from('player_game_logs')
          .upsert(chunk, { 
            onConflict: 'player_id,game_id',
            ignoreDuplicates: true 
          });
        
        if (error) {
          console.error(chalk.red(`Error inserting game logs: ${error.message}`));
          this.stats.errors++;
        } else {
          inserted += chunk.length;
          process.stdout.write(chalk.green('.'));
        }
      } catch (error: any) {
        console.error(chalk.red(`Game logs chunk failed: ${error.message}`));
        this.stats.errors++;
      }
    }
    
    this.stats.gameLogsInserted += inserted;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✓ Inserted ${inserted} game logs in ${duration}s`));
  }
  
  /**
   * Map ESPN player data to our database schema
   */
  async mapAndInsertPlayers(espnPlayers: any[]): Promise<Map<string, number>> {
    console.log(chalk.cyan(`👥 Processing ${espnPlayers.length} players...`));
    
    const playerMap = new Map<string, number>();
    const playersToInsert: any[] = [];
    
    // First, try to match existing players by external_id
    const externalIds = espnPlayers.map(p => `espn_${p.id}`);
    const { data: existingPlayers } = await this.supabase
      .from('players')
      .select('id, external_id')
      .in('external_id', externalIds);
    
    // Build map of existing players
    if (existingPlayers) {
      existingPlayers.forEach(p => {
        playerMap.set(p.external_id, p.id);
      });
    }
    
    // Prepare new players for insertion
    for (const espnPlayer of espnPlayers) {
      const externalId = `espn_${espnPlayer.id}`;
      
      if (!playerMap.has(externalId)) {
        playersToInsert.push({
          external_id: externalId,
          firstname: espnPlayer.firstName || espnPlayer.displayName?.split(' ')[0] || 'Unknown',
          lastname: espnPlayer.lastName || espnPlayer.displayName?.split(' ').slice(1).join(' ') || 'Player',
          position: espnPlayer.position ? [espnPlayer.position] : [],
          jersey_number: espnPlayer.jersey,
          sport_id: espnPlayer.sport || 'unknown',
          status: 'active'
        });
      }
    }
    
    // Bulk insert new players
    if (playersToInsert.length > 0) {
      console.log(chalk.yellow(`Inserting ${playersToInsert.length} new players...`));
      
      const { data: newPlayers, error } = await this.supabase
        .from('players')
        .upsert(playersToInsert, { onConflict: 'external_id' })
        .select('id, external_id');
      
      if (error) {
        console.error(chalk.red(`Error inserting players: ${error.message}`));
        this.stats.errors++;
      } else if (newPlayers) {
        newPlayers.forEach(p => {
          playerMap.set(p.external_id, p.id);
        });
        this.stats.playersUpdated += newPlayers.length;
        console.log(chalk.green(`✓ Inserted ${newPlayers.length} new players`));
      }
    }
    
    return playerMap;
  }
  
  /**
   * Process and store game stats data
   */
  async processGameStats(gameData: any, playerMap: Map<string, number>): Promise<{
    stats: any[],
    logs: any[]
  }> {
    const stats: any[] = [];
    const logs: any[] = [];
    const gameId = gameData.gameId;
    const gameDate = new Date(gameData.timestamp).toISOString().split('T')[0];
    
    if (!gameData.data?.boxscore?.players) {
      return { stats, logs };
    }
    
    // Process each team's players
    for (const teamData of gameData.data.boxscore.players) {
      const teamId = teamData.team.id;
      
      // Process each stat category
      for (const category of teamData.statistics || []) {
        const statCategory = category.name.toLowerCase();
        
        for (const athlete of category.athletes || []) {
          if (!athlete.athlete) continue;
          
          const espnPlayerId = `espn_${athlete.athlete.id}`;
          const playerId = playerMap.get(espnPlayerId);
          
          if (!playerId) {
            console.warn(chalk.yellow(`Player not found: ${espnPlayerId}`));
            continue;
          }
          
          // Parse individual stats
          const individualStats = this.parseStatsByCategory(
            athlete.stats,
            statCategory,
            gameData.sport
          );
          
          // Add individual stat entries
          Object.entries(individualStats).forEach(([statName, statValue]) => {
            if (statValue !== null && statValue !== undefined) {
              stats.push({
                player_id: playerId,
                game_id: gameId,
                stat_type: statName,
                stat_value: String(statValue),
                created_at: new Date().toISOString()
              });
            }
          });
          
          // Create game log entry
          const existingLog = logs.find(l => l.player_id === playerId);
          if (existingLog) {
            // Merge stats from different categories
            Object.assign(existingLog.stats, individualStats);
          } else {
            logs.push({
              player_id: playerId,
              game_id: gameId,
              team_id: teamId,
              game_date: gameDate,
              stats: individualStats,
              fantasy_points: 0, // Will be calculated
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }
    
    return { stats, logs };
  }
  
  /**
   * Parse stats based on category and sport
   */
  private parseStatsByCategory(statsArray: string[], category: string, sport: string): any {
    const stats: any = {};
    
    if (!statsArray || !Array.isArray(statsArray)) return stats;
    
    switch (sport) {
      case 'nfl':
        return this.parseNFLStats(statsArray, category);
      case 'nba':
        return this.parseNBAStats(statsArray, category);
      case 'mlb':
        return this.parseMLBStats(statsArray, category);
      case 'nhl':
        return this.parseNHLStats(statsArray, category);
      default:
        return stats;
    }
  }
  
  private parseNFLStats(stats: string[], category: string): any {
    const parsed: any = {};
    
    switch (category) {
      case 'passing':
        if (stats.length >= 9) {
          const [compAtt, yards, avg, td, int, sacks, qbr, rtg] = stats;
          if (compAtt && compAtt.includes('/')) {
            const [comp, att] = compAtt.split('/');
            parsed.completions = parseInt(comp) || 0;
            parsed.attempts = parseInt(att) || 0;
          }
          parsed.passing_yards = parseInt(yards) || 0;
          parsed.passing_tds = parseInt(td) || 0;
          parsed.interceptions = parseInt(int) || 0;
          parsed.qb_rating = parseFloat(rtg) || 0;
        }
        break;
        
      case 'rushing':
        if (stats.length >= 5) {
          const [car, yards, avg, td, long] = stats;
          parsed.carries = parseInt(car) || 0;
          parsed.rushing_yards = parseInt(yards) || 0;
          parsed.rushing_tds = parseInt(td) || 0;
          parsed.yards_per_carry = parseFloat(avg) || 0;
        }
        break;
        
      case 'receiving':
        if (stats.length >= 6) {
          const [rec, yards, avg, td, long, targets] = stats;
          parsed.receptions = parseInt(rec) || 0;
          parsed.receiving_yards = parseInt(yards) || 0;
          parsed.receiving_tds = parseInt(td) || 0;
          parsed.targets = parseInt(targets) || 0;
        }
        break;
    }
    
    return parsed;
  }
  
  private parseNBAStats(stats: string[], category: string): any {
    // NBA typically has all stats in one array
    if (stats.length >= 15) {
      const [min, fg, threePt, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = stats;
      
      return {
        minutes: parseInt(min) || 0,
        points: parseInt(pts) || 0,
        rebounds: parseInt(reb) || 0,
        assists: parseInt(ast) || 0,
        steals: parseInt(stl) || 0,
        blocks: parseInt(blk) || 0,
        turnovers: parseInt(to) || 0,
        field_goals: fg || '0-0',
        three_pointers: threePt || '0-0',
        free_throws: ft || '0-0',
        plus_minus: parseInt(plusMinus) || 0
      };
    }
    
    return {};
  }
  
  private parseMLBStats(stats: string[], category: string): any {
    const parsed: any = {};
    
    switch (category) {
      case 'batting':
        if (stats.length >= 7) {
          const [ab, r, h, rbi, bb, k, avg] = stats;
          parsed.at_bats = parseInt(ab) || 0;
          parsed.runs = parseInt(r) || 0;
          parsed.hits = parseInt(h) || 0;
          parsed.rbis = parseInt(rbi) || 0;
          parsed.walks = parseInt(bb) || 0;
          parsed.strikeouts = parseInt(k) || 0;
          parsed.batting_avg = parseFloat(avg) || 0;
        }
        break;
        
      case 'pitching':
        if (stats.length >= 9) {
          const [ip, h, r, er, bb, k, hr, era, pc] = stats;
          parsed.innings_pitched = parseFloat(ip) || 0;
          parsed.hits_allowed = parseInt(h) || 0;
          parsed.earned_runs = parseInt(er) || 0;
          parsed.walks_allowed = parseInt(bb) || 0;
          parsed.strikeouts_pitched = parseInt(k) || 0;
          parsed.era = parseFloat(era) || 0;
          parsed.pitch_count = parseInt(pc) || 0;
        }
        break;
    }
    
    return parsed;
  }
  
  private parseNHLStats(stats: string[], category: string): any {
    // NHL stats parsing
    if (stats.length >= 6) {
      const [g, a, pts, plusMinus, pim, sog] = stats;
      
      return {
        goals: parseInt(g) || 0,
        assists: parseInt(a) || 0,
        points: parseInt(pts) || 0,
        plus_minus: parseInt(plusMinus) || 0,
        penalty_minutes: parseInt(pim) || 0,
        shots: parseInt(sog) || 0
      };
    }
    
    return {};
  }
  
  /**
   * Get writer statistics
   */
  getStats() {
    return this.stats;
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      playerStatsInserted: 0,
      gameLogsInserted: 0,
      playersUpdated: 0,
      errors: 0,
      totalTime: 0
    };
  }
}

// Export singleton instance
export const databaseWriter = new DatabaseWriter();