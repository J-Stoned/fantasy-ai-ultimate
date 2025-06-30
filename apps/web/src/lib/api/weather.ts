/**
 * Weather API Integration
 * 
 * Free tier: 1000 calls/day
 * Perfect for checking game-day conditions
 */

import { redis } from '@/lib/redis';

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'demo';
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const CACHE_TTL = 3600; // 1 hour cache for weather

export interface GameWeather {
  temperature: number;
  feels_like: number;
  wind_speed: number;
  wind_direction: number;
  humidity: number;
  precipitation: number;
  conditions: string;
  icon: string;
  impact: {
    passing: number; // -1 to 1 scale
    kicking: number;
    overall: number;
  };
}

export class WeatherAPI {
  private async fetchWeather(lat: number, lon: number): Promise<any> {
    const cacheKey = `weather:${lat}:${lon}`;
    
    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from OpenWeather
    const url = `${WEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache result
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get weather for a specific venue
   */
  async getVenueWeather(venueId: string): Promise<GameWeather | null> {
    // Get venue coordinates from our database
    const venue = await getVenueCoordinates(venueId);
    if (!venue) return null;

    const weather = await this.fetchWeather(venue.lat, venue.lon);
    
    return this.parseWeatherData(weather);
  }

  /**
   * Get weather by city name
   */
  async getCityWeather(city: string, state?: string): Promise<GameWeather | null> {
    const query = state ? `${city},${state},US` : city;
    const url = `${WEATHER_BASE_URL}/weather?q=${encodeURIComponent(query)}&appid=${WEATHER_API_KEY}&units=imperial`;
    
    const response = await fetch(url);
    if (!response.ok) return null;

    const weather = await response.json();
    return this.parseWeatherData(weather);
  }

  /**
   * Parse weather data and calculate fantasy impact
   */
  private parseWeatherData(data: any): GameWeather {
    const temp = data.main.temp;
    const windSpeed = data.wind.speed;
    const humidity = data.main.humidity;
    const precipitation = data.rain?.['1h'] || data.snow?.['1h'] || 0;

    // Calculate fantasy impact
    const impact = this.calculateImpact(temp, windSpeed, precipitation);

    return {
      temperature: Math.round(temp),
      feels_like: Math.round(data.main.feels_like),
      wind_speed: Math.round(windSpeed),
      wind_direction: data.wind.deg,
      humidity: humidity,
      precipitation: precipitation,
      conditions: data.weather[0].description,
      icon: data.weather[0].icon,
      impact,
    };
  }

  /**
   * Calculate weather impact on fantasy performance
   */
  private calculateImpact(temp: number, windSpeed: number, precipitation: number) {
    // Passing impact
    let passingImpact = 0;
    
    // Wind affects passing
    if (windSpeed > 20) passingImpact -= 0.3;
    else if (windSpeed > 15) passingImpact -= 0.2;
    else if (windSpeed > 10) passingImpact -= 0.1;
    
    // Precipitation affects passing
    if (precipitation > 0.5) passingImpact -= 0.3;
    else if (precipitation > 0.1) passingImpact -= 0.15;
    
    // Extreme cold affects passing
    if (temp < 20) passingImpact -= 0.2;
    else if (temp < 32) passingImpact -= 0.1;
    
    // Kicking impact
    let kickingImpact = 0;
    
    // Wind severely affects kicking
    if (windSpeed > 20) kickingImpact -= 0.5;
    else if (windSpeed > 15) kickingImpact -= 0.3;
    else if (windSpeed > 10) kickingImpact -= 0.15;
    
    // Cold affects kicking
    if (temp < 32) kickingImpact -= 0.2;
    
    // Overall impact
    const overallImpact = (passingImpact + kickingImpact) / 2;

    return {
      passing: Math.max(-1, passingImpact),
      kicking: Math.max(-1, kickingImpact),
      overall: Math.max(-1, overallImpact),
    };
  }

  /**
   * Get weather insights for fantasy decisions
   */
  getWeatherInsights(weather: GameWeather): string[] {
    const insights: string[] = [];

    // Wind insights
    if (weather.wind_speed > 20) {
      insights.push('🌬️ SEVERE WIND: Avoid QBs and kickers');
    } else if (weather.wind_speed > 15) {
      insights.push('💨 High wind: Consider fading passing game');
    }

    // Precipitation insights
    if (weather.precipitation > 0.5) {
      insights.push('🌧️ Heavy rain/snow: Favor RBs over pass-catchers');
    } else if (weather.precipitation > 0.1) {
      insights.push('🌦️ Light precipitation: Monitor field conditions');
    }

    // Temperature insights
    if (weather.temperature < 20) {
      insights.push('🥶 Extreme cold: Expect more rushing, fewer points');
    } else if (weather.temperature < 32) {
      insights.push('❄️ Freezing temps: Slight decrease in scoring');
    } else if (weather.temperature > 85) {
      insights.push('🔥 Extreme heat: Monitor player conditioning');
    }

    // Perfect conditions
    if (weather.wind_speed < 10 && 
        weather.precipitation === 0 && 
        weather.temperature > 50 && 
        weather.temperature < 75) {
      insights.push('✅ Perfect conditions: No weather concerns');
    }

    return insights;
  }
}

// Helper function to get venue coordinates
async function getVenueCoordinates(venueId: string): Promise<{ lat: number; lon: number } | null> {
  // This would query your venues table
  // For now, return some common NFL stadiums
  const venues: Record<string, { lat: number; lon: number }> = {
    'lambeau': { lat: 44.5013, lon: -88.0622 }, // Green Bay
    'soldier': { lat: 41.8623, lon: -87.6167 }, // Chicago
    'metlife': { lat: 40.8135, lon: -74.0745 }, // NY Giants/Jets
    'gillette': { lat: 42.0909, lon: -71.2643 }, // New England
    'arrowhead': { lat: 39.0489, lon: -94.4839 }, // Kansas City
  };

  return venues[venueId] || null;
}

// Singleton instance
export const weatherAPI = new WeatherAPI();