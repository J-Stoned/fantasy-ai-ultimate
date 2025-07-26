/**
 * 🔥 LOCAL DATABASE PLAYER DATA SERVICE
 * Uses direct PostgreSQL connection to local Docker database
 * Handles 1.3M+ game logs and player data
 */

import { Pool } from 'pg';
import { databaseConfig } from '@/lib/config/database';
import { logger } from '@/lib/logging/logger';

export interface PlayerProfile {
  id: number;
  name: string;
  firstname?: string;
  lastname?: string;
  position: string;
  team?: string;
  team_abbreviation?: string;
  jersey_number?: string;
  
  // Physical attributes
  heightinches?: number;
  weightlbs?: number;
  birthdate?: string;
  college?: string;
  draft_year?: number;
  draft_round?: number;
  status?: string;
  
  // Sport classification
  sport: string;
  sport_id?: string;
  
  // Avatar system
  avatar_tier?: string;
  avatar_2d_url?: string;
  avatar_3d_url?: string;
  avatar_photo_url?: string;
  photo_url?: string;
  image_url?: string;
  overall_rating?: number;
  avatar_metadata?: any;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface PlayerSearchOptions {
  sport?: string;
  positions?: string[];
  teams?: string[];
  search_term?: string;
  limit?: number;
  include_stats?: boolean;
  include_recent_games?: boolean;
}

class LocalPlayerDataService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'fantasy_ai',
      user: 'fantasy_user',
      password: 'fantasy_password',
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: false
    });
  }

  async getPlayers(options: PlayerSearchOptions = {}) {
    try {
      const {
        sport = 'NFL',
        positions,
        teams,
        search_term,
        limit = 100,
        include_stats = false,
        include_recent_games = false
      } = options;

      let query = `
        SELECT 
          id,
          COALESCE(name, CONCAT(firstname, ' ', lastname)) as name,
          firstname,
          lastname,
          position,
          team,
          team_abbreviation,
          jersey_number,
          heightinches,
          weightlbs,
          birthdate,
          college,
          draft_year,
          draft_round,
          status,
          CASE WHEN sport_id = '1' THEN 'NFL' WHEN sport_id = '2' THEN 'NBA' WHEN sport_id = '3' THEN 'MLB' WHEN sport_id = '4' THEN 'NHL' ELSE sport_id END as sport,
          sport_id,
          avatar_tier,
          avatar_2d_url,
          avatar_3d_url,
          avatar_photo_url,
          photo_url,
          COALESCE(photo_url, avatar_photo_url, avatar_2d_url) as image_url,
          overall_rating,
          avatar_metadata,
          created_at,
          updated_at
         FROM players WHERE sport = $1`;

      const params: any[] = [sport];
      let paramIndex = 2;

      if (positions && positions.length > 0) {
        query += ` AND position = ANY($${paramIndex})`;
        params.push(positions);
        paramIndex++;
      }

      if (teams && teams.length > 0) {
        query += ` AND (team = ANY($${paramIndex}) OR team_abbreviation = ANY($${paramIndex}))`;
        params.push(teams);
        paramIndex++;
      }

      if (search_term) {
        query += ` AND (
          LOWER(COALESCE(name, CONCAT(firstname, ' ', lastname))) LIKE LOWER($${paramIndex}) OR
          LOWER(firstname) LIKE LOWER($${paramIndex}) OR
          LOWER(lastname) LIKE LOWER($${paramIndex})
        )`;
        params.push(`%${search_term}%`);
        paramIndex++;
      }

      query += ` ORDER BY name ASC NULLS FIRST LIMIT ${limit}`;

      logger.info('Executing player query', { query, params });

      const result = await this.pool.query(query, params);
      
      logger.info('Player query successful', { count: result.rows.length });

      return {
        data: result.rows,
        error: null,
        count: result.rows.length
      };

    } catch (error) {
      logger.error('Database query failed:', { error, query: 'getPlayers' });
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Database query failed',
        count: 0
      };
    }
  }

  async getPlayerById(id: number) {
    try {
      const query = `
        SELECT 
          id,
          COALESCE(name, CONCAT(firstname, ' ', lastname)) as name,
          firstname,
          lastname,
          position,
          team,
          team_abbreviation,
          jersey_number,
          heightinches,
          weightlbs,
          birthdate,
          college,
          draft_year,
          draft_round,
          status,
          CASE WHEN sport_id = '1' THEN 'NFL' WHEN sport_id = '2' THEN 'NBA' WHEN sport_id = '3' THEN 'MLB' WHEN sport_id = '4' THEN 'NHL' ELSE sport_id END as sport,
          sport_id,
          avatar_tier,
          avatar_2d_url,
          avatar_3d_url,
          avatar_photo_url,
          photo_url,
          COALESCE(photo_url, avatar_photo_url, avatar_2d_url) as image_url,
          overall_rating,
          avatar_metadata,
          created_at,
          updated_at
        FROM players 
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [id]);
      
      return {
        data: result.rows[0] || null,
        error: null
      };

    } catch (error) {
      logger.error('Failed to get player by ID:', { error, id });
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get player'
      };
    }
  }

  async getDatabaseInfo() {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_players,
          COUNT(CASE WHEN sport_id = '1' THEN 1 END) as nfl_players,
          COUNT(CASE WHEN sport_id = '2' THEN 1 END) as nba_players,
          COUNT(CASE WHEN sport_id = '3' THEN 1 END) as mlb_players,
          COUNT(CASE WHEN sport_id = '4' THEN 1 END) as nhl_players
        FROM players
      `);

      return {
        data: result.rows[0],
        error: null
      };

    } catch (error) {
      logger.error('Failed to get database info:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get database info'
      };
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Export singleton instance
export const localPlayerDataService = new LocalPlayerDataService();