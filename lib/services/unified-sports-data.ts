import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';

// Configuration
const config = {
  supabase: {
    url: 'https://pvekvqiqrrpugfmpgaup.supabase.co',
    key: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  },
  ballDontLie: {
    apiKey: '59de4292-dfc4-4a8a-b337-1e804f4109c6',
    baseUrl: 'https://api.balldontlie.io/v1'
  },
  mlb: {
    baseUrl: 'https://statsapi.mlb.com/api/v1'
  },
  postgres: {
    connectionString: 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres'
  }
};

// Types
interface Game {
  id: string;
  sport: 'NBA' | 'MLB' | 'NFL';
  homeTeam: string;
  awayTeam: string;
  gameDate: Date;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

interface PlayerStats {
  playerId: string;
  playerName: string;
  sport: 'NBA' | 'MLB' | 'NFL';
  stats: Record<string, any>;
  gameDate?: Date;
}

class UnifiedSportsDataService {
  private supabase;
  private ballDontLieApi: AxiosInstance;
  private mlbApi: AxiosInstance;
  private pgPool: Pool;

  constructor() {
    // Initialize Supabase
    this.supabase = createClient(config.supabase.url, config.supabase.key);

    // Initialize APIs
    this.ballDontLieApi = axios.create({
      baseURL: config.ballDontLie.baseUrl,
      headers: { 'Authorization': config.ballDontLie.apiKey }
    });

    this.mlbApi = axios.create({
      baseURL: config.mlb.baseUrl
    });

    // Initialize Postgres
    this.pgPool = new Pool({
      connectionString: config.postgres.connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }

  // ========== DATABASE OPERATIONS ==========
  
  async getRecentGames(sport?: string, limit = 10): Promise<Game[]> {
    let query = this.supabase
      .from('games')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(limit);

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    // Map database format to our Game interface
    return (data || []).map(g => ({
      id: g.id || g.external_id,
      sport: g.sport || 'Unknown',
      homeTeam: g.home_team_id,
      awayTeam: g.away_team_id,
      gameDate: new Date(g.start_time),
      status: g.status,
      homeScore: g.home_score,
      awayScore: g.away_score
    }));
  }

  async getPlayerStatsByESPNId(espnId: string): Promise<PlayerStats[]> {
    const { data, error } = await this.supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', espnId)  // Using player_id for now
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async runPatternAnalysis(gameId: string) {
    const result = await this.pgPool.query(`
      SELECT 
        g.*,
        pp.pattern_name,
        pp.confidence_score,
        pp.expected_value
      FROM games g
      LEFT JOIN pattern_predictions pp ON g.id = pp.game_id
      WHERE g.id = $1
    `, [gameId]);

    return result.rows;
  }

  // ========== NBA API OPERATIONS ==========

  async fetchNBAGamesToday() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const response = await this.ballDontLieApi.get('/games', {
        params: {
          start_date: today,
          end_date: today,
          per_page: 100
        }
      });

      return response.data.data.map((game: any) => ({
        id: `nba_${game.id}`,
        sport: 'NBA' as const,
        homeTeam: game.home_team.full_name,
        awayTeam: game.visitor_team.full_name,
        gameDate: new Date(game.date),
        status: game.status,
        homeScore: game.home_team_score,
        awayScore: game.visitor_team_score
      }));
    } catch (error) {
      console.error('NBA API error:', error);
      return [];
    }
  }

  async fetchNBAPlayerStats(playerId: number, season?: number) {
    try {
      const response = await this.ballDontLieApi.get('/stats', {
        params: {
          player_ids: [playerId],
          seasons: season ? [season] : undefined,
          per_page: 100
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('NBA Player Stats error:', error);
      return [];
    }
  }

  // ========== MLB API OPERATIONS ==========

  async fetchMLBGamesToday() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const response = await this.mlbApi.get('/schedule', {
        params: {
          sportId: 1,
          startDate: today,
          endDate: today
        }
      });

      const games = response.data.dates.flatMap((date: any) => date.games);
      
      return games.map((game: any) => ({
        id: `mlb_${game.gamePk}`,
        sport: 'MLB' as const,
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        gameDate: new Date(game.gameDate),
        status: game.status.detailedState,
        homeScore: game.teams.home.score,
        awayScore: game.teams.away.score
      }));
    } catch (error) {
      console.error('MLB API error:', error);
      return [];
    }
  }

  async fetchMLBPlayerStats(playerId: number, season = 2024) {
    try {
      const response = await this.mlbApi.get(`/people/${playerId}/stats`, {
        params: {
          stats: 'season',
          season: season
        }
      });

      return response.data.stats;
    } catch (error) {
      console.error('MLB Player Stats error:', error);
      return [];
    }
  }

  // ========== UNIFIED OPERATIONS ==========

  async getAllGamesToday(): Promise<Game[]> {
    const [nbaGames, mlbGames, dbGames] = await Promise.all([
      this.fetchNBAGamesToday(),
      this.fetchMLBGamesToday(),
      this.getRecentGames(undefined, 50)
    ]);

    // Merge and deduplicate
    const allGames = [...nbaGames, ...mlbGames];
    const gameMap = new Map<string, Game>();
    
    allGames.forEach(game => gameMap.set(game.id, game));
    
    return Array.from(gameMap.values());
  }

  async syncGamesToDatabase(games: Game[]) {
    const results = await Promise.all(
      games.map(async (game) => {
        const { data, error } = await this.supabase
          .from('games')
          .upsert({
            game_id: game.id,
            sport: game.sport,
            home_team: game.homeTeam,
            away_team: game.awayTeam,
            game_date: game.gameDate.toISOString(),
            status: game.status,
            home_score: game.homeScore,
            away_score: game.awayScore,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'game_id'
          });

        return { game: game.id, success: !error, error };
      })
    );

    return results;
  }

  // ========== ADVANCED QUERIES ==========

  async getPlayerPerformanceTrends(espnId: string, games = 10) {
    const result = await this.pgPool.query(`
      WITH recent_stats AS (
        SELECT 
          ps.*,
          g.home_team,
          g.away_team,
          g.game_date,
          ROW_NUMBER() OVER (ORDER BY g.game_date DESC) as game_num
        FROM player_stats ps
        JOIN games g ON ps.game_id = g.game_id
        WHERE ps.espn_id = $1
        LIMIT $2
      )
      SELECT 
        *,
        AVG(points) OVER (ORDER BY game_date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) as avg_last_5,
        AVG(points) OVER () as season_avg
      FROM recent_stats
      ORDER BY game_date DESC
    `, [espnId, games]);

    return result.rows;
  }

  async getTeamMatchupHistory(team1: string, team2: string) {
    const result = await this.pgPool.query(`
      SELECT 
        *,
        CASE 
          WHEN home_score > away_score THEN home_team
          ELSE away_team
        END as winner,
        ABS(home_score - away_score) as margin
      FROM games
      WHERE 
        (home_team = $1 AND away_team = $2) OR
        (home_team = $2 AND away_team = $1)
      ORDER BY game_date DESC
      LIMIT 20
    `, [team1, team2]);

    return result.rows;
  }

  // Cleanup
  async close() {
    await this.pgPool.end();
  }
}

// Export singleton instance
export const sportsData = new UnifiedSportsDataService();

// Export class for testing
export { UnifiedSportsDataService };