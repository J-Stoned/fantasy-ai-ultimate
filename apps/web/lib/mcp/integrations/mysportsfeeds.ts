/**
 * MySportsFeeds Integration
 * The ONLY sports data source you actually need
 * 
 * By Marcus "The Fixer" Rodriguez
 */

import axios, { AxiosInstance } from 'axios';
import { Redis } from 'ioredis';

export interface MySportsFeedsConfig {
  apiKey: string;
  password: string;
}

export class MySportsFeeds {
  private client: AxiosInstance;
  private redis: Redis;
  private baseURL = 'https://api.mysportsfeeds.com/v2.1/pull';
  
  constructor(config: MySportsFeedsConfig) {
    // Create authenticated client
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: config.apiKey,
        password: config.password
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Redis for caching
    this.redis = new Redis(process.env.REDIS_URL!);
  }
  
  /**
   * Get player data with smart caching
   */
  async getPlayerData(playerIdOrName: string) {
    const cacheKey = `msf:player:${playerIdOrName}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      // Try multiple endpoints to find the player
      const response = await this.client.get(`/nfl/players.json`, {
        params: {
          player: playerIdOrName,
          playerstats: 'passing,rushing,receiving'
        }
      });
      
      const data = response.data;
      
      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds error:', error);
      return null;
    }
  }
  
  /**
   * Get game data
   */
  async getGameData(gameId: string) {
    const cacheKey = `msf:game:${gameId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const response = await this.client.get(`/nfl/games/${gameId}.json`, {
        params: {
          boxscore: true,
          playbyplay: false // Too expensive
        }
      });
      
      const data = response.data;
      
      // Cache completed games forever, live games for 1 minute
      const ttl = data.game.isCompleted ? 86400 * 7 : 60;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds error:', error);
      return null;
    }
  }
  
  /**
   * Get current season standings
   */
  async getLeagueData(league: string = 'nfl') {
    const cacheKey = `msf:standings:${league}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const season = this.getCurrentSeason();
      const response = await this.client.get(`/${league}/${season}/standings.json`);
      
      const data = response.data;
      
      // Cache for 6 hours
      await this.redis.setex(cacheKey, 21600, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds error:', error);
      return null;
    }
  }
  
  /**
   * Search for players
   */
  async search(query: string) {
    const cacheKey = `msf:search:${query.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const response = await this.client.get('/nfl/players.json', {
        params: {
          search: query,
          limit: 20,
          playerstats: 'passing,rushing,receiving'
        }
      });
      
      const data = response.data;
      
      // Cache for 24 hours
      await this.redis.setex(cacheKey, 86400, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds search error:', error);
      return { players: [] };
    }
  }
  
  /**
   * Get historical data for ML predictions
   */
  async getHistoricalData(playerId: string, weeks: number = 10) {
    const cacheKey = `msf:history:${playerId}:${weeks}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const season = this.getCurrentSeason();
      const response = await this.client.get(`/nfl/${season}/player_gamelogs.json`, {
        params: {
          player: playerId,
          limit: weeks,
          sort: 'game.startTime.D'
        }
      });
      
      const data = response.data;
      
      // Process data for ML consumption
      const processedData = this.processForML(data.gamelogs);
      
      // Cache for 24 hours
      await this.redis.setex(cacheKey, 86400, JSON.stringify(processedData));
      
      return processedData;
    } catch (error) {
      console.error('MySportsFeeds historical error:', error);
      return [];
    }
  }
  
  /**
   * Get injury reports
   */
  async getInjuryData() {
    const cacheKey = 'msf:injuries:current';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const response = await this.client.get('/nfl/injuries.json');
      
      const data = response.data;
      
      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds injury error:', error);
      return { injuries: [] };
    }
  }
  
  /**
   * Get DFS salaries (for DraftKings/FanDuel alternatives)
   */
  async getDFSSalaries(site: 'draftkings' | 'fanduel' = 'draftkings') {
    const cacheKey = `msf:dfs:${site}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    try {
      const response = await this.client.get('/nfl/dfs.json', {
        params: {
          dfssite: site,
          position: 'all'
        }
      });
      
      const data = response.data;
      
      // Cache for 2 hours
      await this.redis.setex(cacheKey, 7200, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('MySportsFeeds DFS error:', error);
      return { players: [] };
    }
  }
  
  /**
   * Process data for ML consumption
   */
  private processForML(gamelogs: any[]) {
    return gamelogs.map(log => ({
      date: log.game.startTime,
      opponent: log.game.awayTeamAbbreviation === log.team.abbreviation 
        ? log.game.homeTeamAbbreviation 
        : log.game.awayTeamAbbreviation,
      isHome: log.game.homeTeamAbbreviation === log.team.abbreviation,
      stats: {
        passingYards: log.stats.passing?.passYards || 0,
        passingTDs: log.stats.passing?.passTD || 0,
        rushingYards: log.stats.rushing?.rushYards || 0,
        rushingTDs: log.stats.rushing?.rushTD || 0,
        receivingYards: log.stats.receiving?.recYards || 0,
        receivingTDs: log.stats.receiving?.recTD || 0,
        receptions: log.stats.receiving?.receptions || 0,
        targets: log.stats.receiving?.targets || 0,
        fantasyPoints: this.calculateFantasyPoints(log.stats)
      }
    }));
  }
  
  /**
   * Calculate fantasy points (PPR scoring)
   */
  private calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Passing
    if (stats.passing) {
      points += (stats.passing.passYards || 0) * 0.04;
      points += (stats.passing.passTD || 0) * 4;
      points -= (stats.passing.passInt || 0) * 2;
    }
    
    // Rushing
    if (stats.rushing) {
      points += (stats.rushing.rushYards || 0) * 0.1;
      points += (stats.rushing.rushTD || 0) * 6;
    }
    
    // Receiving (PPR)
    if (stats.receiving) {
      points += (stats.receiving.receptions || 0) * 1;
      points += (stats.receiving.recYards || 0) * 0.1;
      points += (stats.receiving.recTD || 0) * 6;
    }
    
    // Fumbles
    points -= (stats.fumbles?.fumLost || 0) * 2;
    
    return Math.round(points * 100) / 100;
  }
  
  /**
   * Get current season based on date
   */
  private getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // NFL season runs Aug-Feb
    if (month >= 7) {
      return `${year}-${year + 1}-regular`;
    } else if (month <= 1) {
      return `${year - 1}-${year}-regular`;
    }
    
    // Off-season
    return `${year - 1}-${year}-regular`;
  }
}