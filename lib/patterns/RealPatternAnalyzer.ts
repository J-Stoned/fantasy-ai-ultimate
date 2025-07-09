/**
 * REAL Pattern Analyzer - No More Math.random()!
 * Uses actual game data to detect betting patterns
 */

import { PrismaClient } from '@prisma/client';
import { differenceInHours, subDays, addDays } from 'date-fns';

const prisma = new PrismaClient();

export interface PatternResult {
  type: string;
  detected: boolean;
  confidence: number;
  impact: number;
  factors: Record<string, any>;
  recommendation: string;
}

export interface GameAnalysis {
  gameId: number;
  patterns: PatternResult[];
  totalConfidence: number;
  bestPlay: string;
}

export class RealPatternAnalyzer {
  /**
   * Analyze all patterns for a single game
   */
  async analyzeGame(gameId: number): Promise<GameAnalysis> {
    const patterns = await Promise.all([
      this.analyzeBackToBackFade(gameId),
      this.analyzeEmbarrassmentRevenge(gameId),
      this.analyzeAltitudeAdvantage(gameId),
      this.analyzePerfectStorm(gameId),
      this.analyzeDivisionDogBite(gameId)
    ]);

    const detectedPatterns = patterns.filter(p => p.detected);
    const totalConfidence = detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / 
                          (detectedPatterns.length || 1);

    return {
      gameId,
      patterns,
      totalConfidence,
      bestPlay: this.determineBestPlay(patterns)
    };
  }

  /**
   * Back-to-Back Fade Pattern
   * Teams playing on consecutive nights perform worse
   */
  async analyzeBackToBackFade(gameId: number): Promise<PatternResult> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        home_team: true,
        away_team: true
      }
    });

    if (!game) {
      return this.noPattern('back-to-back-fade');
    }

    // Check previous games for both teams
    const yesterday = subDays(new Date(game.date), 1);
    const twoDaysAgo = subDays(new Date(game.date), 2);

    const [homeRecentGames, awayRecentGames] = await Promise.all([
      prisma.game.findMany({
        where: {
          OR: [
            { home_team_id: game.home_team_id },
            { away_team_id: game.home_team_id }
          ],
          date: {
            gte: twoDaysAgo,
            lt: new Date(game.date)
          }
        },
        orderBy: { date: 'desc' }
      }),
      prisma.game.findMany({
        where: {
          OR: [
            { home_team_id: game.away_team_id },
            { away_team_id: game.away_team_id }
          ],
          date: {
            gte: twoDaysAgo,
            lt: new Date(game.date)
          }
        },
        orderBy: { date: 'desc' }
      })
    ]);

    // Check if either team played yesterday
    const homePlayedYesterday = homeRecentGames.some(g => 
      g.date.toDateString() === yesterday.toDateString()
    );
    const awayPlayedYesterday = awayRecentGames.some(g => 
      g.date.toDateString() === yesterday.toDateString()
    );

    if (!homePlayedYesterday && !awayPlayedYesterday) {
      return this.noPattern('back-to-back-fade');
    }

    // Calculate travel distance if played yesterday
    let travelDistance = 0;
    if (homePlayedYesterday && homeRecentGames[0]) {
      const wasAway = homeRecentGames[0].away_team_id === game.home_team_id;
      if (wasAway) {
        // Rough estimate - would use real geo data in production
        travelDistance = 500; // miles
      }
    }

    const confidence = this.calculateBackToBackConfidence(
      homePlayedYesterday,
      awayPlayedYesterday,
      travelDistance
    );

    return {
      type: 'back-to-back-fade',
      detected: true,
      confidence,
      impact: -3.5, // Expected point differential
      factors: {
        homePlayedYesterday,
        awayPlayedYesterday,
        travelDistance,
        restAdvantage: homePlayedYesterday ? 'away' : 'home'
      },
      recommendation: homePlayedYesterday 
        ? `Fade ${game.home_team?.name} - Back-to-back game`
        : `Fade ${game.away_team?.name} - Back-to-back game`
    };
  }

  /**
   * Embarrassment Revenge Pattern
   * Teams seek revenge after being blown out
   */
  async analyzeEmbarrassmentRevenge(gameId: number): Promise<PatternResult> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        home_team: true,
        away_team: true
      }
    });

    if (!game) {
      return this.noPattern('embarrassment-revenge');
    }

    // Find last meeting between these teams
    const lastMeeting = await prisma.game.findFirst({
      where: {
        OR: [
          {
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id
          },
          {
            home_team_id: game.away_team_id,
            away_team_id: game.home_team_id
          }
        ],
        date: { lt: game.date },
        status: 'COMPLETED'
      },
      orderBy: { date: 'desc' }
    });

    if (!lastMeeting || !lastMeeting.home_score || !lastMeeting.away_score) {
      return this.noPattern('embarrassment-revenge');
    }

    const marginOfDefeat = Math.abs(lastMeeting.home_score - lastMeeting.away_score);
    const embarrassmentThreshold = 20; // 20+ point loss

    if (marginOfDefeat < embarrassmentThreshold) {
      return this.noPattern('embarrassment-revenge');
    }

    // Determine who was embarrassed
    const homeWasEmbarrassed = 
      (lastMeeting.home_team_id === game.home_team_id && lastMeeting.home_score < lastMeeting.away_score) ||
      (lastMeeting.away_team_id === game.home_team_id && lastMeeting.away_score < lastMeeting.home_score);

    const confidence = Math.min(marginOfDefeat / 30, 0.9);

    return {
      type: 'embarrassment-revenge',
      detected: true,
      confidence,
      impact: marginOfDefeat * 0.15,
      factors: {
        lastMeetingMargin: marginOfDefeat,
        daysSinceLastMeeting: differenceInHours(game.date, lastMeeting.date) / 24,
        embarrassedTeam: homeWasEmbarrassed ? game.home_team?.name : game.away_team?.name,
        venueChange: lastMeeting.home_team_id !== game.home_team_id
      },
      recommendation: homeWasEmbarrassed
        ? `Back ${game.home_team?.name} - Revenge game after ${marginOfDefeat} point loss`
        : `Back ${game.away_team?.name} - Revenge game after ${marginOfDefeat} point loss`
    };
  }

  /**
   * Altitude Advantage Pattern
   * Teams struggle in high altitude venues
   */
  async analyzeAltitudeAdvantage(gameId: number): Promise<PatternResult> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        home_team: { include: { venue: true } },
        away_team: { include: { venue: true } }
      }
    });

    if (!game) {
      return this.noPattern('altitude-advantage');
    }

    // High altitude venues (Denver, Utah, etc.)
    const HIGH_ALTITUDE_CITIES = ['Denver', 'Salt Lake City', 'Phoenix'];
    const homeVenue = game.home_team?.venue;
    const awayVenue = game.away_team?.venue;

    if (!homeVenue || !awayVenue) {
      return this.noPattern('altitude-advantage');
    }

    const homeIsHighAltitude = HIGH_ALTITUDE_CITIES.some(city => 
      homeVenue.city?.includes(city)
    );
    const awayIsHighAltitude = HIGH_ALTITUDE_CITIES.some(city => 
      awayVenue.city?.includes(city)
    );

    if (!homeIsHighAltitude || awayIsHighAltitude) {
      return this.noPattern('altitude-advantage');
    }

    // Check away team's recent games at altitude
    const awayAltitudeGames = await prisma.game.count({
      where: {
        OR: [
          { home_team_id: game.away_team_id },
          { away_team_id: game.away_team_id }
        ],
        date: {
          gte: subDays(game.date, 30),
          lt: game.date
        },
        home_team: {
          venue: {
            city: { in: HIGH_ALTITUDE_CITIES }
          }
        }
      }
    });

    const confidence = awayAltitudeGames === 0 ? 0.75 : 0.4;

    return {
      type: 'altitude-advantage',
      detected: true,
      confidence,
      impact: 4.5,
      factors: {
        venue: homeVenue.name,
        altitude: 'High',
        awayTeamAltitudeExperience: awayAltitudeGames,
        daysAtSeaLevel: 30
      },
      recommendation: `Back ${game.home_team?.name} - Altitude advantage at ${homeVenue.city}`
    };
  }

  /**
   * Perfect Storm Pattern
   * Multiple negative factors align
   */
  async analyzePerfectStorm(gameId: number): Promise<PatternResult> {
    const [b2b, revenge, altitude] = await Promise.all([
      this.analyzeBackToBackFade(gameId),
      this.analyzeEmbarrassmentRevenge(gameId),
      this.analyzeAltitudeAdvantage(gameId)
    ]);

    const factors = [b2b, revenge, altitude].filter(p => p.detected);
    
    if (factors.length < 2) {
      return this.noPattern('perfect-storm');
    }

    const totalConfidence = factors.reduce((sum, f) => sum + f.confidence, 0) / factors.length;
    const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);

    return {
      type: 'perfect-storm',
      detected: true,
      confidence: Math.min(totalConfidence * 1.2, 0.95),
      impact: totalImpact,
      factors: {
        patterns: factors.map(f => f.type),
        alignedFactors: factors.length,
        compoundEffect: true
      },
      recommendation: `Strong play - ${factors.length} patterns aligned!`
    };
  }

  /**
   * Division Dog Bite Pattern
   * Division underdogs perform better than expected
   */
  async analyzeDivisionDogBite(gameId: number): Promise<PatternResult> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        home_team: true,
        away_team: true
      }
    });

    if (!game || !game.home_team || !game.away_team) {
      return this.noPattern('division-dog-bite');
    }

    // Check if division rivals
    const sameDivision = game.home_team.division === game.away_team.division;
    if (!sameDivision) {
      return this.noPattern('division-dog-bite');
    }

    // Get recent performance
    const [homeRecord, awayRecord] = await Promise.all([
      this.getRecentRecord(game.home_team_id, 10),
      this.getRecentRecord(game.away_team_id, 10)
    ]);

    const homeWinPct = homeRecord.wins / (homeRecord.total || 1);
    const awayWinPct = awayRecord.wins / (awayRecord.total || 1);

    // Check if there's a clear underdog
    const winPctDiff = Math.abs(homeWinPct - awayWinPct);
    if (winPctDiff < 0.2) {
      return this.noPattern('division-dog-bite');
    }

    const underdog = homeWinPct < awayWinPct ? 'home' : 'away';
    const confidence = Math.min(winPctDiff * 2, 0.8);

    return {
      type: 'division-dog-bite',
      detected: true,
      confidence,
      impact: 3.0,
      factors: {
        division: game.home_team.division,
        underdog: underdog === 'home' ? game.home_team.name : game.away_team.name,
        homeRecord: `${homeRecord.wins}-${homeRecord.losses}`,
        awayRecord: `${awayRecord.wins}-${awayRecord.losses}`,
        winPctDiff
      },
      recommendation: `Back ${underdog === 'home' ? game.home_team.name : game.away_team.name} - Division underdog`
    };
  }

  /**
   * Helper Methods
   */
  private calculateBackToBackConfidence(
    homeB2B: boolean,
    awayB2B: boolean,
    travelDistance: number
  ): number {
    let confidence = 0;
    
    if (homeB2B) confidence += 0.4;
    if (awayB2B) confidence += 0.4;
    if (travelDistance > 1000) confidence += 0.2;
    if (travelDistance > 2000) confidence += 0.1;
    
    return Math.min(confidence, 0.85);
  }

  private async getRecentRecord(teamId: number, games: number) {
    const recentGames = await prisma.game.findMany({
      where: {
        OR: [
          { home_team_id: teamId },
          { away_team_id: teamId }
        ],
        status: 'COMPLETED',
        home_score: { not: null },
        away_score: { not: null }
      },
      orderBy: { date: 'desc' },
      take: games
    });

    let wins = 0;
    let losses = 0;

    recentGames.forEach(game => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score! : game.away_score!;
      const oppScore = isHome ? game.away_score! : game.home_score!;
      
      if (teamScore > oppScore) wins++;
      else losses++;
    });

    return { wins, losses, total: wins + losses };
  }

  private determineBestPlay(patterns: PatternResult[]): string {
    const detected = patterns.filter(p => p.detected);
    if (detected.length === 0) return 'No clear play';

    // Sort by confidence
    detected.sort((a, b) => b.confidence - a.confidence);
    
    return detected[0].recommendation;
  }

  private noPattern(type: string): PatternResult {
    return {
      type,
      detected: false,
      confidence: 0,
      impact: 0,
      factors: {},
      recommendation: 'Pattern not detected'
    };
  }
}