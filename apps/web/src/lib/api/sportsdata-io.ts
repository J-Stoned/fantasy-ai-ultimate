/**
 * SportsData.io API Integration
 * 
 * Free tier: 1,000 API calls per month
 * Provides NFL stats, projections, DFS data
 */

import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import pLimit from 'p-limit';

const SPORTSDATA_BASE = 'https://api.sportsdata.io/v3/nfl';
const CACHE_TTL = 3600; // 1 hour cache to conserve API calls
const CALLS_PER_MONTH = 1000;
const CALLS_PER_DAY = Math.floor(CALLS_PER_MONTH / 30); // ~33 per day

// Very conservative rate limiting
const rateLimiter = pLimit(1); // 1 request at a time

export interface SportsDataPlayer {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  Status: string;
  InjuryStatus?: string;
  InjuryBodyPart?: string;
  InjuryNotes?: string;
  FantasyPoints?: number;
  ProjectedFantasyPoints?: number;
  AverageDraftPosition?: number;
  DraftKingsSalary?: number;
  FanDuelSalary?: number;
  YahooSalary?: number;
}

export interface SportsDataGame {
  GameKey: string;
  Date: string;
  SeasonType: number;
  Week: number;
  AwayTeam: string;
  HomeTeam: string;
  AwayScore?: number;
  HomeScore?: number;
  Status: string;
  StadiumID: number;
  Stadium?: string;
}

export interface SportsDataProjection {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  PassingYards?: number;
  PassingTouchdowns?: number;
  RushingYards?: number;
  RushingTouchdowns?: number;
  ReceivingYards?: number;
  ReceivingTouchdowns?: number;
  Receptions?: number;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  FantasyPointsDraftKings: number;
  FantasyPointsFanDuel: number;
}

export interface SportsDataStats {
  PlayerID: number;
  Season: number;
  Week: number;
  Team: string;
  PassingCompletions?: number;
  PassingAttempts?: number;
  PassingYards?: number;
  PassingTouchdowns?: number;
  Interceptions?: number;
  RushingAttempts?: number;
  RushingYards?: number;
  RushingTouchdowns?: number;
  Receptions?: number;
  ReceivingYards?: number;
  ReceivingTouchdowns?: number;
  FantasyPoints: number;
}

export class SportsDataAPI {
  private apiKey: string | undefined;
  private callsToday: number = 0;
  private lastResetDate: string;

  constructor() {
    this.apiKey = process.env.SPORTSDATA_IO_KEY;
    this.lastResetDate = new Date().toISOString().split('T')[0];
    
    if (!this.apiKey || this.apiKey === 'your-sportsdata-key') {
      console.warn('SportsData.io API: No valid API key found');
    }
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiKey !== 'your-sportsdata-key');
  }

  /**
   * Track API usage
   */
  private async trackUsage(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily counter
    if (today !== this.lastResetDate) {
      this.callsToday = 0;
      this.lastResetDate = today;
    }

    // Check daily limit
    if (this.callsToday >= CALLS_PER_DAY) {
      console.warn(`SportsData.io: Daily limit reached (${CALLS_PER_DAY} calls)`);
      return false;
    }

    // Track in database
    try {
      const usage = await prisma.apiUsage.findFirst({
        where: {
          api_name: 'sportsdata_io',
          date: today,
        },
      });

      if (!usage) {
        await prisma.apiUsage.create({
          data: {
            api_name: 'sportsdata_io',
            date: today,
            calls: 1,
            daily_limit: CALLS_PER_DAY,
          },
        });
      } else {
        await prisma.apiUsage.update({
          where: { id: usage.id },
          data: { calls: usage.calls + 1 },
        });
        
        if (usage.calls >= CALLS_PER_DAY) {
          return false;
        }
      }
    } catch (error) {
      console.error('Error tracking API usage:', error);
    }

    this.callsToday++;
    return true;
  }

  /**
   * Fetch with rate limiting and caching
   */
  private async fetchWithRateLimit(endpoint: string, format: string = 'json'): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('SportsData.io API not configured');
    }

    const cacheKey = `sportsdata:${endpoint}`;

    // Check cache first
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Check rate limit
    const canProceed = await this.trackUsage();
    if (!canProceed) {
      throw new Error('SportsData.io API rate limit exceeded');
    }

    // Rate limited fetch
    const data = await rateLimiter(async () => {
      const url = `${SPORTSDATA_BASE}/${format}${endpoint}?key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SportsData.io API error: ${response.status}`);
      }

      return response.json();
    });

    // Cache result
    if (redis && data) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get current week
   */
  async getCurrentWeek(): Promise<number> {
    try {
      const data = await this.fetchWithRateLimit('/CurrentWeek');
      return data;
    } catch (error) {
      console.error('Error getting current week:', error);
      // Fallback calculation
      const now = new Date();
      const seasonStart = new Date(now.getFullYear(), 8, 1);
      const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.min(Math.max(1, weeksSinceStart), 18);
    }
  }

  /**
   * Get player projections for a week
   */
  async getProjections(week?: number): Promise<SportsDataProjection[]> {
    try {
      const currentWeek = week || await this.getCurrentWeek();
      const data = await this.fetchWithRateLimit(`/PlayerGameProjectionStatsByWeek/2024/${currentWeek}`);
      return data.map((proj: any) => ({
        PlayerID: proj.PlayerID,
        Name: proj.Name,
        Team: proj.Team,
        Position: proj.Position,
        PassingYards: proj.PassingYards,
        PassingTouchdowns: proj.PassingTouchdowns,
        RushingYards: proj.RushingYards,
        RushingTouchdowns: proj.RushingTouchdowns,
        ReceivingYards: proj.ReceivingYards,
        ReceivingTouchdowns: proj.ReceivingTouchdowns,
        Receptions: proj.Receptions,
        FantasyPoints: proj.FantasyPoints,
        FantasyPointsPPR: proj.FantasyPointsPPR,
        FantasyPointsDraftKings: proj.FantasyPointsDraftKings,
        FantasyPointsFanDuel: proj.FantasyPointsFanDuel,
      }));
    } catch (error) {
      console.error('Error getting projections:', error);
      return [];
    }
  }

  /**
   * Get DFS salaries
   */
  async getDFSSalaries(): Promise<SportsDataPlayer[]> {
    try {
      const data = await this.fetchWithRateLimit('/DfsSlatesByWeek/2024/1');
      
      // Extract player salaries from slates
      const players: SportsDataPlayer[] = [];
      data.forEach((slate: any) => {
        slate.DfsSlateGames?.forEach((game: any) => {
          game.DfsSlatePlayers?.forEach((player: any) => {
            players.push({
              PlayerID: player.PlayerID,
              Name: player.Name,
              Team: player.Team,
              Position: player.Position,
              Status: player.Status,
              DraftKingsSalary: player.OperatorSalary,
              FanDuelSalary: player.OperatorSalary,
              YahooSalary: player.OperatorSalary,
            });
          });
        });
      });

      return players;
    } catch (error) {
      console.error('Error getting DFS salaries:', error);
      return [];
    }
  }

  /**
   * Get injury updates
   */
  async getInjuries(): Promise<SportsDataPlayer[]> {
    try {
      const data = await this.fetchWithRateLimit('/Injuries');
      return data.map((player: any) => ({
        PlayerID: player.PlayerID,
        Name: player.Name,
        Team: player.Team,
        Position: player.Position,
        Status: player.Status,
        InjuryStatus: player.InjuryStatus,
        InjuryBodyPart: player.InjuryBodyPart,
        InjuryNotes: player.InjuryNotes,
      }));
    } catch (error) {
      console.error('Error getting injuries:', error);
      return [];
    }
  }

  /**
   * Get player details
   */
  async getPlayer(playerId: number): Promise<SportsDataPlayer | null> {
    try {
      const data = await this.fetchWithRateLimit(`/Player/${playerId}`);
      return {
        PlayerID: data.PlayerID,
        Name: data.Name,
        Team: data.Team,
        Position: data.Position,
        Status: data.Status,
        AverageDraftPosition: data.AverageDraftPosition,
      };
    } catch (error) {
      console.error('Error getting player:', error);
      return null;
    }
  }

  /**
   * Get season stats for a player
   */
  async getPlayerSeasonStats(playerId: number, season: number = 2024): Promise<SportsDataStats | null> {
    try {
      const data = await this.fetchWithRateLimit(`/PlayerSeasonStatsByPlayerID/${season}/${playerId}`);
      return {
        PlayerID: data.PlayerID,
        Season: data.Season,
        Week: 0, // Season total
        Team: data.Team,
        PassingCompletions: data.PassingCompletions,
        PassingAttempts: data.PassingAttempts,
        PassingYards: data.PassingYards,
        PassingTouchdowns: data.PassingTouchdowns,
        Interceptions: data.Interceptions,
        RushingAttempts: data.RushingAttempts,
        RushingYards: data.RushingYards,
        RushingTouchdowns: data.RushingTouchdowns,
        Receptions: data.Receptions,
        ReceivingYards: data.ReceivingYards,
        ReceivingTouchdowns: data.ReceivingTouchdowns,
        FantasyPoints: data.FantasyPoints,
      };
    } catch (error) {
      console.error('Error getting player stats:', error);
      return null;
    }
  }

  /**
   * Get schedule
   */
  async getSchedule(week?: number): Promise<SportsDataGame[]> {
    try {
      const endpoint = week 
        ? `/ScoresByWeek/2024/${week}`
        : '/Scores/2024';
      
      const data = await this.fetchWithRateLimit(endpoint);
      return data.map((game: any) => ({
        GameKey: game.GameKey,
        Date: game.Date,
        SeasonType: game.SeasonType,
        Week: game.Week,
        AwayTeam: game.AwayTeam,
        HomeTeam: game.HomeTeam,
        AwayScore: game.AwayScore,
        HomeScore: game.HomeScore,
        Status: game.Status,
        StadiumID: game.StadiumID,
        Stadium: game.StadiumDetails?.Name,
      }));
    } catch (error) {
      console.error('Error getting schedule:', error);
      return [];
    }
  }

  /**
   * Get remaining API calls
   */
  async getRemainingCalls(): Promise<{
    daily: number;
    monthly: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    try {
      // Get daily usage
      const dailyUsage = await prisma.apiUsage.findFirst({
        where: {
          api_name: 'sportsdata_io',
          date: today,
        },
      });

      // Get monthly usage
      const monthlyUsage = await prisma.apiUsage.aggregate({
        where: {
          api_name: 'sportsdata_io',
          date: {
            startsWith: currentMonth,
          },
        },
        _sum: {
          calls: true,
        },
      });

      return {
        daily: CALLS_PER_DAY - (dailyUsage?.calls || 0),
        monthly: CALLS_PER_MONTH - (monthlyUsage._sum.calls || 0),
      };
    } catch (error) {
      console.error('Error getting remaining calls:', error);
      return {
        daily: CALLS_PER_DAY - this.callsToday,
        monthly: CALLS_PER_MONTH,
      };
    }
  }

  /**
   * Get ADP (Average Draft Position) data
   */
  async getADP(): Promise<any[]> {
    try {
      const data = await this.fetchWithRateLimit('/FantasyPlayers');
      return data
        .filter((p: any) => p.AverageDraftPosition)
        .sort((a: any, b: any) => a.AverageDraftPosition - b.AverageDraftPosition)
        .map((player: any) => ({
          PlayerID: player.PlayerID,
          Name: player.Name,
          Team: player.Team,
          Position: player.Position,
          ADP: player.AverageDraftPosition,
          AverageDraftPositionPPR: player.AverageDraftPositionPPR,
        }));
    } catch (error) {
      console.error('Error getting ADP:', error);
      return [];
    }
  }
}

// Singleton instance
export const sportsDataAPI = new SportsDataAPI();