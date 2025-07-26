/**
 * League Database Service
 * Handles database operations for imported fantasy leagues
 */

import { sql } from '@vercel/postgres';
import { logger } from '../logging/logger';
import { playerDataService } from '../database/player-data-service';

export interface DatabaseLeague {
  id: string;
  platform_id: string;
  platform: string;
  name: string;
  sport: string;
  season: string;
  team_count: number;
  scoring_type: string;
  is_active: boolean;
  my_team_id?: string;
  my_team_name?: string;
  current_standing?: number;
  settings?: any;
  last_synced?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DatabasePlayer {
  id: string;
  platform_id: string;
  league_id: string;
  team_id?: string;
  name: string;
  position: string;
  team: string;
  injury_status?: string;
  projected_points?: number;
  season_points?: number;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export class LeagueDatabaseService {
  /**
   * Save or update league in database
   */
  async saveLeague(league: Partial<DatabaseLeague>): Promise<DatabaseLeague> {
    try {
      const result = await sql`
        INSERT INTO fantasy_leagues (
          id, platform_id, platform, name, sport, season, 
          team_count, scoring_type, is_active, my_team_id, 
          my_team_name, current_standing, settings, last_synced
        )
        VALUES (
          ${league.id}, ${league.platform_id}, ${league.platform}, 
          ${league.name}, ${league.sport}, ${league.season},
          ${league.team_count}, ${league.scoring_type}, ${league.is_active},
          ${league.my_team_id}, ${league.my_team_name}, ${league.current_standing},
          ${JSON.stringify(league.settings)}, ${league.last_synced || new Date()}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          team_count = EXCLUDED.team_count,
          scoring_type = EXCLUDED.scoring_type,
          is_active = EXCLUDED.is_active,
          my_team_id = EXCLUDED.my_team_id,
          my_team_name = EXCLUDED.my_team_name,
          current_standing = EXCLUDED.current_standing,
          settings = EXCLUDED.settings,
          last_synced = EXCLUDED.last_synced,
          updated_at = NOW()
        RETURNING *
      `;
      
      return result.rows[0] as DatabaseLeague;
    } catch (error) {
      logger.error('Error saving league:', { error: error });
      throw new Error('Failed to save league to database');
    }
  }

  /**
   * Get leagues by user/platform
   */
  async getLeaguesByPlatform(platform: string): Promise<DatabaseLeague[]> {
    try {
      const result = await sql`
        SELECT * FROM fantasy_leagues 
        WHERE platform = ${platform}
        ORDER BY created_at DESC
      `;
      
      return result.rows as DatabaseLeague[];
    } catch (error) {
      logger.error('Error getting leagues:', { error: error });
      throw new Error('Failed to get leagues from database');
    }
  }

  /**
   * Get single league by ID
   */
  async getLeague(leagueId: string): Promise<DatabaseLeague | null> {
    try {
      const result = await sql`
        SELECT * FROM fantasy_leagues 
        WHERE id = ${leagueId}
        LIMIT 1
      `;
      
      return result.rows[0] as DatabaseLeague || null;
    } catch (error) {
      logger.error('Error getting league:', { error: error });
      throw new Error('Failed to get league from database');
    }
  }

  /**
   * Save player roster data - OPTIMIZED batch insert
   */
  async savePlayers(players: Partial<DatabasePlayer>[]): Promise<void> {
    if (players.length === 0) return;
    
    try {
      // Prepare batch insert values
      const values = players.map((player, index) => {
        const offset = index * 11; // 11 columns per player
        return `(
          $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 
          $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, 
          $${offset + 9}, $${offset + 10}, $${offset + 11}
        )`;
      }).join(', ');

      // Flatten all player data
      const params = players.flatMap(player => [
        player.id,
        player.platform_id,
        player.league_id,
        player.team_id,
        player.name,
        player.position,
        player.team,
        player.injury_status,
        player.projected_points,
        player.season_points,
        player.image_url
      ]);

      // Execute single batch insert
      await sql`
        INSERT INTO fantasy_players (
          id, platform_id, league_id, team_id, name, 
          position, team, injury_status, projected_points, 
          season_points, image_url
        )
        VALUES ${values}
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          name = EXCLUDED.name,
          position = EXCLUDED.position,
          team = EXCLUDED.team,
          injury_status = EXCLUDED.injury_status,
          projected_points = EXCLUDED.projected_points,
          season_points = EXCLUDED.season_points,
          image_url = EXCLUDED.image_url,
          updated_at = NOW()
      `;
      
      logger.info('✅ Batch inserted/updated ${players.length} players in single query');
    } catch (error) {
      logger.error('Error batch saving players:', { error: error });
      throw new Error('Failed to batch save players to database');
    }
  }

  /**
   * Get players for a league
   */
  async getLeaguePlayers(leagueId: string): Promise<DatabasePlayer[]> {
    try {
      const result = await sql`
        SELECT * FROM fantasy_players 
        WHERE league_id = ${leagueId}
        ORDER BY name ASC
      `;
      
      return result.rows as DatabasePlayer[];
    } catch (error) {
      logger.error('Error getting players:', { error: error });
      throw new Error('Failed to get players from database');
    }
  }

  /**
   * Get enriched league players with real game stats, avatars, and performance data
   */
  async getEnrichedLeaguePlayers(leagueId: string): Promise<any[]> {
    try {
      // Get basic league players
      const leaguePlayers = await this.getLeaguePlayers(leagueId);
      
      if (leaguePlayers.length === 0) {
        return [];
      }
      
      // Enrich each player with real data from our 1.57M game stats
      const enrichedPlayers = await Promise.all(
        leaguePlayers.map(async (leaguePlayer) => {
          try {
            // Try to find matching player in our main database by name
            const { data: realPlayers } = await playerDataService.getPlayers({
              search_term: leaguePlayer.name,
              limit: 1,
              include_stats: true
            });
            
            const realPlayer = realPlayers?.[0];
            
            if (realPlayer) {
              // Merge league data with real player data
              return {
                // League-specific data
                id: leaguePlayer.id,
                platformId: leaguePlayer.platform_id,
                leagueId: leaguePlayer.league_id,
                teamId: leaguePlayer.team_id,
                
                // Enhanced player data from our database
                name: realPlayer.name,
                position: realPlayer.position,
                team: realPlayer.team_abbreviation || leaguePlayer.team,
                sport: realPlayer.sport,
                
                // Performance data from 1.57M game stats
                overallRating: realPlayer.overall_rating,
                avatarTier: realPlayer.avatar_tier || 'practice',
                avgFantasyPoints: realPlayer.season_stats?.avg_fantasy_points || leaguePlayer.projected_points,
                consistency: realPlayer.season_stats?.consistency_score,
                trending: realPlayer.trending || 'stable',
                
                // Avatar system
                avatar2dUrl: realPlayer.avatar_2d_url,
                avatar3dUrl: realPlayer.avatar_3d_url,
                avatarPhotoUrl: realPlayer.avatar_photo_url,
                imageUrl: realPlayer.image_url || leaguePlayer.image_url,
                
                // DFS data
                dkPoints: realPlayer.season_stats?.avg_dk_points,
                fdPoints: realPlayer.season_stats?.avg_fd_points,
                yahooPoints: realPlayer.season_stats?.avg_yahoo_points,
                
                // Player metadata
                age: realPlayer.age,
                college: realPlayer.college,
                jerseyNumber: realPlayer.jersey_number,
                draftYear: realPlayer.draft_year,
                
                // League-specific projections
                projectedPoints: leaguePlayer.projected_points,
                seasonPoints: leaguePlayer.season_points,
                injuryStatus: leaguePlayer.injury_status,
                
                // Data source indicators
                hasRealData: true,
                dataSource: '1.57M game stats dataset'
              };
            } else {
              // Fallback to league data only
              return {
                ...leaguePlayer,
                hasRealData: false,
                dataSource: 'platform import only',
                avatarTier: 'practice',
                trending: 'stable'
              };
            }
          } catch (error) {
            logger.warn(`Failed to enrich player ${leaguePlayer.name}:`, error);
            return {
              ...leaguePlayer,
              hasRealData: false,
              dataSource: 'platform import only',
              avatarTier: 'practice',
              trending: 'stable'
            };
          }
        })
      );
      
      // Sort by performance (real data first, then by projected points)
      enrichedPlayers.sort((a, b) => {
        if (a.hasRealData && !b.hasRealData) return -1;
        if (!a.hasRealData && b.hasRealData) return 1;
        
        const aPoints = a.avgFantasyPoints || a.projectedPoints || 0;
        const bPoints = b.avgFantasyPoints || b.projectedPoints || 0;
        return bPoints - aPoints;
      });
      
      logger.info(`Enriched ${enrichedPlayers.filter(p => p.hasRealData).length}/${enrichedPlayers.length} league players with real data`);
      
      return enrichedPlayers;
      
    } catch (error) {
      logger.error('Error getting enriched league players:', { error: error });
      throw new Error('Failed to get enriched league players');
    }
  }

  /**
   * Update league sync status
   */
  async updateSyncStatus(leagueId: string): Promise<void> {
    try {
      await sql`
        UPDATE fantasy_leagues 
        SET last_synced = NOW(), updated_at = NOW()
        WHERE id = ${leagueId}
      `;
    } catch (error) {
      logger.error('Error updating sync status:', { error: error });
      throw new Error('Failed to update sync status');
    }
  }

  /**
   * Delete league and associated data
   */
  async deleteLeague(leagueId: string): Promise<void> {
    try {
      // Delete players first (foreign key constraint)
      await sql`DELETE FROM fantasy_players WHERE league_id = ${leagueId}`;
      
      // Delete league
      await sql`DELETE FROM fantasy_leagues WHERE id = ${leagueId}`;
    } catch (error) {
      logger.error('Error deleting league:', { error: error });
      throw new Error('Failed to delete league from database');
    }
  }

  /**
   * Get user's league summary stats
   */
  async getLeagueSummary(): Promise<{
    totalLeagues: number;
    platforms: { platform: string; count: number }[];
    sports: { sport: string; count: number }[];
    lastSync: Date | null;
  }> {
    try {
      const [totalResult, platformsResult, sportsResult, syncResult] = await Promise.all([
        sql`SELECT COUNT(*) as total FROM fantasy_leagues`,
        sql`
          SELECT platform, COUNT(*) as count 
          FROM fantasy_leagues 
          GROUP BY platform 
          ORDER BY count DESC
        `,
        sql`
          SELECT sport, COUNT(*) as count 
          FROM fantasy_leagues 
          GROUP BY sport 
          ORDER BY count DESC
        `,
        sql`
          SELECT MAX(last_synced) as last_sync 
          FROM fantasy_leagues
        `
      ]);

      return {
        totalLeagues: parseInt(totalResult.rows[0].total),
        platforms: platformsResult.rows.map(row => ({
          platform: row.platform,
          count: parseInt(row.count)
        })),
        sports: sportsResult.rows.map(row => ({
          sport: row.sport,
          count: parseInt(row.count)
        })),
        lastSync: syncResult.rows[0].last_sync
      };
    } catch (error) {
      logger.error('Error getting league summary:', { error: error });
      throw new Error('Failed to get league summary');
    }
  }

  /**
   * Create database tables if they don't exist
   */
  async initializeDatabase(): Promise<void> {
    try {
      // Create fantasy_leagues table
      await sql`
        CREATE TABLE IF NOT EXISTS fantasy_leagues (
          id VARCHAR(255) PRIMARY KEY,
          platform_id VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          sport VARCHAR(50) NOT NULL,
          season VARCHAR(10) NOT NULL,
          team_count INTEGER NOT NULL,
          scoring_type VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          my_team_id VARCHAR(255),
          my_team_name VARCHAR(255),
          current_standing INTEGER,
          settings JSONB,
          last_synced TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;

      // Create fantasy_players table
      await sql`
        CREATE TABLE IF NOT EXISTS fantasy_players (
          id VARCHAR(255) PRIMARY KEY,
          platform_id VARCHAR(255) NOT NULL,
          league_id VARCHAR(255) NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
          team_id VARCHAR(255),
          name VARCHAR(255) NOT NULL,
          position VARCHAR(10) NOT NULL,
          team VARCHAR(10) NOT NULL,
          injury_status VARCHAR(50),
          projected_points DECIMAL(10,2),
          season_points DECIMAL(10,2),
          image_url TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;

      // Create indexes for better performance
      await sql`CREATE INDEX IF NOT EXISTS idx_leagues_platform ON fantasy_leagues(platform)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_leagues_sport ON fantasy_leagues(sport)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_players_league ON fantasy_players(league_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_players_team ON fantasy_players(team_id)`;

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Error initializing database:', { error: error });
      throw new Error('Failed to initialize database tables');
    }
  }
}