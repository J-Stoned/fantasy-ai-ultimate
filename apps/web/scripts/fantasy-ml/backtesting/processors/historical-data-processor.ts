import { Pool } from 'pg';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { createHash } from 'crypto';

interface SportConfig {
  tableName: string;
  dateField: string;
  primaryDays: number[]; // 0=Sunday, 1=Monday, etc.
  seasonStart: { month: number; day: number };
  seasonEnd: { month: number; day: number };
  minGamesPerSlate: number;
}

interface HistoricalSlate {
  date: Date;
  sport: string;
  games: any[];
  players: any[];
  injuries: any[];
  weather?: any[];
  news?: any[];
  ownership?: any[];
  results?: any[];
}

export class HistoricalDataProcessor {
  private pool: Pool;
  private sportConfigs: Record<string, SportConfig> = {
    NFL: {
      tableName: 'nfl_game_logs',
      dateField: 'game_date',
      primaryDays: [0, 1, 4], // Sunday, Monday, Thursday
      seasonStart: { month: 9, day: 1 },
      seasonEnd: { month: 2, day: 15 },
      minGamesPerSlate: 6
    },
    NBA: {
      tableName: 'nba_game_logs',
      dateField: 'game_date',
      primaryDays: [0, 1, 2, 3, 4, 5, 6], // Every day
      seasonStart: { month: 10, day: 15 },
      seasonEnd: { month: 6, day: 15 },
      minGamesPerSlate: 4
    },
    MLB: {
      tableName: 'mlb_game_logs',
      dateField: 'game_date',
      primaryDays: [0, 1, 2, 3, 4, 5, 6], // Every day
      seasonStart: { month: 3, day: 20 },
      seasonEnd: { month: 10, day: 31 },
      minGamesPerSlate: 6
    },
    NHL: {
      tableName: 'nhl_game_logs',
      dateField: 'game_date',
      primaryDays: [0, 1, 2, 3, 4, 5, 6], // Every day
      seasonStart: { month: 10, day: 1 },
      seasonEnd: { month: 6, day: 15 },
      minGamesPerSlate: 3
    }
  };

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sports_betting_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    });
  }

  async processHistoricalData(
    sport: string,
    startYear: number = 2018,
    endYear: number = 2025
  ): Promise<HistoricalSlate[]> {
    console.log(`🏈 Processing ${sport} historical data from ${startYear} to ${endYear}...`);
    
    const config = this.sportConfigs[sport];
    if (!config) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    const slates: HistoricalSlate[] = [];
    
    for (let year = startYear; year <= endYear; year++) {
      const seasonSlates = await this.processSeasonData(sport, year, config);
      slates.push(...seasonSlates);
    }

    console.log(`✅ Processed ${slates.length} ${sport} slates`);
    return slates;
  }

  private async processSeasonData(
    sport: string,
    year: number,
    config: SportConfig
  ): Promise<HistoricalSlate[]> {
    const slates: HistoricalSlate[] = [];
    
    // Determine season date range
    const seasonStart = new Date(year, config.seasonStart.month - 1, config.seasonStart.day);
    const seasonEnd = config.seasonEnd.month < config.seasonStart.month
      ? new Date(year + 1, config.seasonEnd.month - 1, config.seasonEnd.day)
      : new Date(year, config.seasonEnd.month - 1, config.seasonEnd.day);

    let currentDate = seasonStart;
    
    while (currentDate <= seasonEnd) {
      // Check if this is a primary game day for the sport
      if (config.primaryDays.includes(currentDate.getDay())) {
        const slate = await this.fetchSlateData(sport, currentDate, config);
        
        if (slate && slate.games.length >= config.minGamesPerSlate) {
          slates.push(slate);
        }
      }
      
      currentDate = addDays(currentDate, 1);
    }

    return slates;
  }

  private async fetchSlateData(
    sport: string,
    date: Date,
    config: SportConfig
  ): Promise<HistoricalSlate | null> {
    try {
      // Fetch games for this date
      const gamesQuery = `
        SELECT DISTINCT
          g.*,
          t1.name as home_team,
          t2.name as away_team
        FROM ${config.tableName} g
        LEFT JOIN teams t1 ON g.home_team_id = t1.id
        LEFT JOIN teams t2 ON g.away_team_id = t2.id
        WHERE DATE(g.${config.dateField}) = $1
        ORDER BY g.${config.dateField}
      `;
      
      const gamesResult = await this.pool.query(gamesQuery, [format(date, 'yyyy-MM-dd')]);
      
      if (gamesResult.rows.length === 0) {
        return null;
      }

      // Fetch player performances for these games
      const gameIds = gamesResult.rows.map(g => g.game_id);
      const playersQuery = `
        SELECT 
          p.*,
          pl.name as player_name,
          pl.position,
          t.name as team_name
        FROM ${sport.toLowerCase()}_player_logs p
        LEFT JOIN players pl ON p.player_id = pl.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE p.game_id = ANY($1)
        ORDER BY p.fantasy_points_dk DESC
      `;
      
      const playersResult = await this.pool.query(playersQuery, [gameIds]);

      // Fetch injury data if available
      const injuriesQuery = `
        SELECT * FROM injuries
        WHERE sport = $1 
        AND DATE(report_date) = $2
      `;
      
      const injuriesResult = await this.pool.query(injuriesQuery, [sport, format(date, 'yyyy-MM-dd')]);

      // Fetch weather data for outdoor sports
      let weatherData = [];
      if (['NFL', 'MLB'].includes(sport)) {
        const weatherQuery = `
          SELECT * FROM weather_data
          WHERE sport = $1 
          AND DATE(game_date) = $2
        `;
        
        const weatherResult = await this.pool.query(weatherQuery, [sport, format(date, 'yyyy-MM-dd')]);
        weatherData = weatherResult.rows;
      }

      // Create slate object
      const slate: HistoricalSlate = {
        date,
        sport,
        games: gamesResult.rows,
        players: playersResult.rows,
        injuries: injuriesResult.rows,
        weather: weatherData,
        news: [], // To be populated from news collection
        ownership: [], // To be populated from ownership data
        results: [] // To be populated after contest results
      };

      return slate;
    } catch (error) {
      console.error(`Error fetching slate data for ${sport} on ${format(date, 'yyyy-MM-dd')}:`, error);
      return null;
    }
  }

  async enrichSlateWithOwnership(slate: HistoricalSlate): Promise<void> {
    // Fetch historical ownership data if available
    const ownershipQuery = `
      SELECT * FROM ownership_projections
      WHERE sport = $1 
      AND DATE(slate_date) = $2
    `;
    
    const ownershipResult = await this.pool.query(ownershipQuery, [
      slate.sport,
      format(slate.date, 'yyyy-MM-dd')
    ]);
    
    slate.ownership = ownershipResult.rows;
  }

  async enrichSlateWithResults(slate: HistoricalSlate): Promise<void> {
    // Fetch contest results if available
    const resultsQuery = `
      SELECT * FROM contest_results
      WHERE sport = $1 
      AND DATE(contest_date) = $2
    `;
    
    const resultsResult = await this.pool.query(resultsQuery, [
      slate.sport,
      format(slate.date, 'yyyy-MM-dd')
    ]);
    
    slate.results = resultsResult.rows;
  }

  async saveProcessedSlate(slate: HistoricalSlate): Promise<void> {
    const slateId = createHash('md5')
      .update(`${slate.sport}-${format(slate.date, 'yyyy-MM-dd')}`)
      .digest('hex');

    const query = `
      INSERT INTO historical_slates (
        id, sport, slate_date, games_count, players_count,
        has_injuries, has_weather, has_ownership, has_results,
        data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        games_count = EXCLUDED.games_count,
        players_count = EXCLUDED.players_count,
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      slateId,
      slate.sport,
      slate.date,
      slate.games.length,
      slate.players.length,
      slate.injuries.length > 0,
      slate.weather && slate.weather.length > 0,
      slate.ownership && slate.ownership.length > 0,
      slate.results && slate.results.length > 0,
      JSON.stringify(slate)
    ]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}