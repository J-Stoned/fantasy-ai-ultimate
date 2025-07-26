/**
 * 🌤️ Weather Impact Service
 * Tracks weather conditions and their impact on fantasy sports
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface WeatherConditions {
  game_id: string;
  stadium: string;
  city: string;
  game_time: Date;
  temperature: number; // Fahrenheit
  wind_speed: number; // MPH
  wind_direction: string;
  precipitation: number; // Percentage
  humidity: number; // Percentage
  conditions: 'clear' | 'cloudy' | 'rain' | 'snow' | 'dome';
  last_updated: Date;
}

export interface WeatherImpact {
  game_id: string;
  sport: string;
  overall_impact: number; // -1 to 1 (negative = bad, positive = good)
  passing_impact: number;
  rushing_impact: number;
  kicking_impact: number;
  hitting_impact?: number; // For MLB
  scoring_impact: number;
  notes: string[];
}

export class WeatherService extends EventEmitter {
  private pool: Pool;
  private weatherCache: Map<string, WeatherConditions> = new Map();
  private impactCache: Map<string, WeatherImpact> = new Map();

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  /**
   * Initialize weather service
   */
  async initialize(): Promise<void> {
    console.log('🌤️ Initializing Weather Service...');
    
    // Load current weather data (with error handling)
    try {
      await this.loadWeatherData();
    } catch (error) {
      console.log('⚠️ Weather data table not available, using mock data');
      this.generateMockData();
    }
    
    console.log(`✅ Weather service initialized with ${this.weatherCache.size} game weather records`);
  }

  /**
   * Load weather data from database
   */
  private async loadWeatherData(): Promise<void> {
    const query = `
      SELECT 
        g.id as game_id,
        s.name as stadium,
        s.city,
        g.game_time,
        gw.temperature,
        gw.wind_speed,
        gw.wind_direction,
        gw.precipitation,
        gw.humidity,
        gw.conditions,
        gw.last_updated
      FROM games g
      JOIN stadiums s ON g.stadium_id = s.id
      LEFT JOIN game_weather gw ON g.id = gw.game_id
      WHERE g.game_date >= CURRENT_DATE
        AND g.game_date <= CURRENT_DATE + INTERVAL '7 days'
        AND s.is_outdoor = true
      ORDER BY g.game_time`;
    
    const result = await this.pool.query(query);
    
    this.weatherCache.clear();
    this.impactCache.clear();
    
    result.rows.forEach(row => {
      const weather: WeatherConditions = {
        game_id: row.game_id,
        stadium: row.stadium,
        city: row.city,
        game_time: row.game_time,
        temperature: row.temperature || 72,
        wind_speed: row.wind_speed || 0,
        wind_direction: row.wind_direction || 'N',
        precipitation: row.precipitation || 0,
        humidity: row.humidity || 50,
        conditions: row.conditions || 'clear',
        last_updated: row.last_updated || new Date()
      };
      
      this.weatherCache.set(row.game_id, weather);
      
      // Calculate impact
      const sport = this.getSportFromGameId(row.game_id);
      if (sport) {
        const impact = this.calculateWeatherImpact(weather, sport);
        this.impactCache.set(row.game_id, impact);
      }
    });
  }

  /**
   * Generate mock weather data when database tables not available
   */
  private generateMockData(): void {
    const mockWeather = [
      { game_id: 'game1', stadium: 'Arrowhead Stadium', city: 'Kansas City', temp: 42, wind: 12, conditions: 'cloudy' as const },
      { game_id: 'game2', stadium: 'Lambeau Field', city: 'Green Bay', temp: 28, wind: 18, conditions: 'snow' as const },
      { game_id: 'game3', stadium: 'Mercedes-Benz Superdome', city: 'New Orleans', temp: 72, wind: 3, conditions: 'dome' as const },
    ];

    mockWeather.forEach(weather => {
      const conditions: WeatherConditions = {
        game_id: weather.game_id,
        stadium: weather.stadium,
        city: weather.city,
        game_time: new Date(),
        temperature: weather.temp,
        wind_speed: weather.wind,
        wind_direction: 'NW',
        precipitation: weather.conditions === 'snow' ? 80 : weather.conditions === 'rain' ? 60 : 0,
        humidity: 50,
        conditions: weather.conditions,
        last_updated: new Date()
      };
      
      this.weatherCache.set(weather.game_id, conditions);
      
      // Calculate impact for NFL
      const impact = this.calculateWeatherImpact(conditions, 'nfl');
      this.impactCache.set(weather.game_id, impact);
    });
  }

  /**
   * Calculate weather impact on fantasy scoring
   */
  private calculateWeatherImpact(weather: WeatherConditions, sport: string): WeatherImpact {
    const impact: WeatherImpact = {
      game_id: weather.game_id,
      sport,
      overall_impact: 0,
      passing_impact: 0,
      rushing_impact: 0,
      kicking_impact: 0,
      scoring_impact: 0,
      notes: []
    };
    
    // Temperature impacts
    if (weather.temperature < 32) {
      impact.overall_impact -= 0.2;
      impact.passing_impact -= 0.3;
      impact.kicking_impact -= 0.2;
      impact.notes.push('🥶 Freezing conditions affect passing and kicking');
    } else if (weather.temperature < 40) {
      impact.overall_impact -= 0.1;
      impact.passing_impact -= 0.15;
      impact.notes.push('❄️ Cold weather may reduce passing efficiency');
    } else if (weather.temperature > 90) {
      impact.overall_impact -= 0.1;
      impact.rushing_impact -= 0.1;
      impact.notes.push('🔥 Hot weather may cause fatigue');
    }
    
    // Wind impacts
    if (weather.wind_speed > 20) {
      impact.overall_impact -= 0.3;
      impact.passing_impact -= 0.4;
      impact.kicking_impact -= 0.5;
      impact.notes.push('💨 High winds severely impact passing and kicking');
    } else if (weather.wind_speed > 15) {
      impact.overall_impact -= 0.15;
      impact.passing_impact -= 0.2;
      impact.kicking_impact -= 0.3;
      impact.notes.push('🌬️ Moderate winds affect deep passes');
    } else if (weather.wind_speed > 10) {
      impact.passing_impact -= 0.1;
      impact.kicking_impact -= 0.15;
    }
    
    // Precipitation impacts
    if (weather.precipitation > 70) {
      impact.overall_impact -= 0.25;
      impact.passing_impact -= 0.3;
      impact.rushing_impact += 0.1; // Rushing becomes more valuable
      impact.scoring_impact -= 0.2;
      impact.notes.push('🌧️ Heavy rain favors rushing attack');
    } else if (weather.precipitation > 40) {
      impact.overall_impact -= 0.1;
      impact.passing_impact -= 0.15;
      impact.notes.push('🌦️ Light rain may affect ball handling');
    }
    
    // Snow impacts
    if (weather.conditions === 'snow') {
      impact.overall_impact -= 0.3;
      impact.passing_impact -= 0.4;
      impact.kicking_impact -= 0.3;
      impact.scoring_impact -= 0.25;
      impact.notes.push('❄️ Snow significantly impacts all aspects');
    }
    
    // Sport-specific adjustments
    if (sport === 'nfl') {
      // NFL is most affected by weather
      // No additional adjustments needed
    } else if (sport === 'mlb') {
      // MLB specific impacts
      impact.hitting_impact = impact.overall_impact;
      
      if (weather.wind_speed > 15) {
        // Wind can help or hurt based on direction
        impact.hitting_impact += 0.1; // Assume favorable for now
        impact.notes.push('⚾ Wind may affect fly balls');
      }
      
      if (weather.temperature < 50) {
        impact.hitting_impact -= 0.15;
        impact.notes.push('⚾ Cold weather reduces ball flight');
      }
    }
    
    // Cap impacts
    impact.overall_impact = Math.max(-1, Math.min(1, impact.overall_impact));
    impact.passing_impact = Math.max(-1, Math.min(1, impact.passing_impact));
    impact.rushing_impact = Math.max(-1, Math.min(1, impact.rushing_impact));
    impact.kicking_impact = Math.max(-1, Math.min(1, impact.kicking_impact));
    impact.scoring_impact = Math.max(-1, Math.min(1, impact.scoring_impact));
    
    return impact;
  }

  /**
   * Get weather conditions for a game
   */
  getGameWeather(gameId: string): WeatherConditions | null {
    return this.weatherCache.get(gameId) || null;
  }

  /**
   * Get weather impact for a game
   */
  getWeatherImpact(gameId: string): WeatherImpact | null {
    return this.impactCache.get(gameId) || null;
  }

  /**
   * Get all games with significant weather
   */
  getSignificantWeatherGames(threshold: number = -0.2): Array<{
    game: WeatherConditions;
    impact: WeatherImpact;
  }> {
    const significant: Array<{ game: WeatherConditions; impact: WeatherImpact }> = [];
    
    this.impactCache.forEach((impact, gameId) => {
      if (impact.overall_impact <= threshold) {
        const weather = this.weatherCache.get(gameId);
        if (weather) {
          significant.push({ game: weather, impact });
        }
      }
    });
    
    return significant.sort((a, b) => a.impact.overall_impact - b.impact.overall_impact);
  }

  /**
   * Update weather data for a game
   */
  async updateGameWeather(
    gameId: string,
    conditions: Partial<WeatherConditions>
  ): Promise<void> {
    const query = `
      INSERT INTO game_weather (
        game_id, temperature, wind_speed, wind_direction, 
        precipitation, humidity, conditions, last_updated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (game_id) DO UPDATE SET
        temperature = $2,
        wind_speed = $3,
        wind_direction = $4,
        precipitation = $5,
        humidity = $6,
        conditions = $7,
        last_updated = NOW()`;
    
    await this.pool.query(query, [
      gameId,
      conditions.temperature,
      conditions.wind_speed,
      conditions.wind_direction,
      conditions.precipitation,
      conditions.humidity,
      conditions.conditions
    ]);
    
    // Reload weather data
    await this.loadWeatherData();
    
    // Emit update event
    this.emit('weather:update', { gameId, conditions });
  }

  /**
   * Get weather report for all games
   */
  getWeatherReport(sport?: string): {
    total_games: number;
    dome_games: number;
    outdoor_games: number;
    significant_weather_games: number;
    worst_conditions: Array<{ game: WeatherConditions; impact: WeatherImpact }>;
  } {
    let games = Array.from(this.weatherCache.values());
    
    if (sport) {
      games = games.filter(g => this.getSportFromGameId(g.game_id) === sport);
    }
    
    const domeGames = games.filter(g => g.conditions === 'dome').length;
    const outdoorGames = games.length - domeGames;
    const significantWeather = this.getSignificantWeatherGames();
    
    return {
      total_games: games.length,
      dome_games: domeGames,
      outdoor_games: outdoorGames,
      significant_weather_games: significantWeather.length,
      worst_conditions: significantWeather.slice(0, 5)
    };
  }

  /**
   * Helper to determine sport from game ID
   */
  private getSportFromGameId(gameId: string): string | null {
    if (gameId.startsWith('nfl_')) return 'nfl';
    if (gameId.startsWith('mlb_')) return 'mlb';
    if (gameId.startsWith('nhl_')) return 'nhl';
    if (gameId.startsWith('nba_')) return 'nba';
    return null;
  }

  /**
   * Mock weather data for testing
   */
  async generateMockWeather(gameId: string, sport: string): Promise<void> {
    const conditions = [
      { temp: 75, wind: 5, precip: 0, cond: 'clear' as const },
      { temp: 65, wind: 12, precip: 20, cond: 'cloudy' as const },
      { temp: 45, wind: 18, precip: 60, cond: 'rain' as const },
      { temp: 28, wind: 15, precip: 80, cond: 'snow' as const },
      { temp: 85, wind: 8, precip: 10, cond: 'cloudy' as const }
    ];
    
    const random = conditions[Math.floor(Math.random() * conditions.length)];
    
    await this.updateGameWeather(gameId, {
      temperature: random.temp,
      wind_speed: random.wind,
      precipitation: random.precip,
      conditions: random.cond,
      humidity: 50 + Math.random() * 40,
      wind_direction: ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'][Math.floor(Math.random() * 8)]
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.removeAllListeners();
    console.log('🧹 Weather service disposed');
  }
}