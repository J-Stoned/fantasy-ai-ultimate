import { NextRequest, NextResponse } from 'next/server';
import { LeagueDatabaseService } from '../../../../lib/services/league-database-service';
import { realtimeServer } from '../../../../lib/services/websocket-server';
import { logger } from '../../../../lib/logging/logger';

const dbService = new LeagueDatabaseService();

// POST /api/roster/recommendations - Get AI-powered roster recommendations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      leagueId, 
      currentLineup, 
      bench, 
      analysisType = 'comprehensive',
      focusAreas = ['optimization', 'risk', 'value']
    } = body;
    
    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Get league and player data
    const [league, players] = await Promise.all([
      dbService.getLeague(leagueId),
      dbService.getLeaguePlayers(leagueId)
    ]);

    if (!league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    // Generate comprehensive recommendations
    const recommendations = await generateRecommendations({
      league: league as DatabaseLeagueInfo,
      players: players as DatabasePlayerInfo[],
      currentLineup,
      bench,
      analysisType,
      focusAreas
    });

    // Get waiver wire suggestions
    const waiverWireSuggestions = await getWaiverWireSuggestions(league as DatabaseLeagueInfo, players as DatabasePlayerInfo[]);

    // Get trade recommendations
    const tradeRecommendations = await getTradeRecommendations(league as DatabaseLeagueInfo, players as DatabasePlayerInfo[], currentLineup);

    // Generate matchup analysis
    const matchupAnalysis = await generateMatchupAnalysis(currentLineup, league as DatabaseLeagueInfo);

    // Calculate confidence scores
    const analysis = {
      overallGrade: calculateOverallGrade(currentLineup),
      riskLevel: calculateRiskLevel(currentLineup),
      projectedPoints: calculateProjectedPoints(currentLineup),
      ceiling: calculateCeiling(currentLineup),
      floor: calculateFloor(currentLineup),
      consistency: calculateConsistency(currentLineup)
    };

    // Broadcast recommendations via WebSocket
    const userId = getUserIdFromRequest(request);
    realtimeServer.publishToChannel(`user:${userId}:recommendations`, {
      type: 'recommendations:updated',
      leagueId,
      recommendations,
      analysis,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      recommendations: {
        startSit: recommendations.filter(r => r.category === 'lineup'),
        waiverWire: waiverWireSuggestions,
        trades: tradeRecommendations,
        injury: recommendations.filter(r => r.category === 'injury'),
        matchup: matchupAnalysis
      },
      analysis,
      generated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error generating recommendations:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

// GET /api/roster/recommendations - Get cached recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const type = searchParams.get('type') || 'all';
    
    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Get cached recommendations (in a real app, you'd use Redis or database)
    const cachedRecommendations = await getCachedRecommendations(leagueId, type);

    return NextResponse.json({
      success: true,
      recommendations: cachedRecommendations,
      cached: true,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching recommendations:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

// Helper functions for generating recommendations

async function generateRecommendations({
  league,
  players,
  currentLineup,
  bench,
  analysisType,
  focusAreas
}: RecommendationGenerationParams): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Start/Sit Analysis
  if (focusAreas.includes('optimization')) {
    const startSitRecs = await generateStartSitRecommendations(currentLineup, bench, players);
    recommendations.push(...startSitRecs);
  }

  // Risk Assessment
  if (focusAreas.includes('risk')) {
    const riskRecs = await generateRiskAssessment(currentLineup, players);
    recommendations.push(...riskRecs);
  }

  // Value Opportunities
  if (focusAreas.includes('value')) {
    const valueRecs = await generateValueOpportunities(players, league);
    recommendations.push(...valueRecs);
  }

  // Injury Monitoring
  const injuryRecs = await generateInjuryRecommendations(currentLineup, bench);
  recommendations.push(...injuryRecs);

  // Bye Week Planning
  const byeWeekRecs = await generateByeWeekRecommendations(currentLineup, bench);
  recommendations.push(...byeWeekRecs);

  // Sort by priority and confidence
  return recommendations
    .sort((a, b) => (b.priority * b.confidence) - (a.priority * a.confidence))
    .slice(0, 10); // Return top 10 recommendations
}

async function generateStartSitRecommendations(
  currentLineup: LineupSlot[],
  bench: RosterPlayer[],
  allPlayers: DatabasePlayerInfo[]
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  for (const slot of currentLineup) {
    if (!slot.player) continue;

    // Find better bench options for this position
    const benchAlternatives = bench.filter(player => 
      canPlayPosition(player.position, slot.position) &&
      (player.projectedPoints || 0) > (slot.player.projectedPoints || 0)
    );

    if (benchAlternatives.length > 0) {
      const bestAlternative = benchAlternatives[0];
      const pointsGain = (bestAlternative.projectedPoints || 0) - (slot.player.projectedPoints || 0);
      
      recommendations.push({
        id: `start-sit-${slot.position}-${bestAlternative.id}`,
        category: 'lineup',
        type: 'start_sit',
        priority: Math.min(10, pointsGain * 2), // Higher priority for bigger gains
        confidence: calculateStartSitConfidence(slot.player, bestAlternative),
        title: `Start ${bestAlternative.name} over ${slot.player.name}`,
        description: `${bestAlternative.name} has a better matchup and is projected for ${pointsGain.toFixed(1)} more points`,
        expectedGain: pointsGain,
        reasoning: [
          `Better matchup rating: ${bestAlternative.matchupRating} vs ${slot.player.matchupRating}`,
          `Recent form: ${bestAlternative.trends?.direction || 'stable'} trending`,
          `Projected: ${bestAlternative.projectedPoints?.toFixed(1)} vs ${slot.player.projectedPoints?.toFixed(1)} points`
        ],
        action: {
          type: 'swap',
          out: slot.player.id,
          in: bestAlternative.id,
          position: slot.position
        },
        tags: ['lineup', 'optimization', 'start-sit']
      });
    }

    // Check for red flags with current starter
    const redFlags = checkPlayerRedFlags(slot.player);
    if (redFlags.length > 0) {
      recommendations.push({
        id: `red-flag-${slot.player.id}`,
        category: 'lineup',
        type: 'warning',
        priority: 8,
        confidence: 0.9,
        title: `⚠️ ${slot.player.name} has concerns`,
        description: redFlags.join(', '),
        expectedGain: 0,
        reasoning: redFlags,
        action: {
          type: 'monitor',
          playerId: slot.player.id
        },
        tags: ['warning', 'risk']
      });
    }
  }

  return recommendations;
}

async function generateRiskAssessment(currentLineup: LineupSlot[], allPlayers: DatabasePlayerInfo[]): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  for (const slot of currentLineup) {
    if (!slot.player) continue;

    const riskFactors = calculateRiskFactors(slot.player);
    
    if (riskFactors.totalRisk > 5) { // High risk threshold
      recommendations.push({
        id: `risk-${slot.player.id}`,
        category: 'risk',
        type: 'risk_warning',
        priority: riskFactors.totalRisk,
        confidence: 0.85,
        title: `High risk: ${slot.player.name}`,
        description: `Multiple risk factors detected for ${slot.player.name}`,
        expectedGain: 0,
        reasoning: riskFactors.factors,
        action: {
          type: 'consider_backup',
          playerId: slot.player.id
        },
        tags: ['risk', 'warning'],
        riskScore: riskFactors.totalRisk
      });
    }
  }

  return recommendations;
}

async function generateValueOpportunities(players: DatabasePlayerInfo[], league: DatabaseLeagueInfo): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Find undervalued players (low ownership, high projection)
  const undervaluedPlayers = players
    .filter(player => (player.ownership || 0) < 50 && (player.projectedPoints || 0) > 10)
    .sort((a, b) => (b.projectedPoints / (b.ownership || 1)) - (a.projectedPoints / (a.ownership || 1)))
    .slice(0, 3);

  undervaluedPlayers.forEach(player => {
    recommendations.push({
      id: `value-${player.id}`,
      category: 'value',
      type: 'sleeper_pick',
      priority: 6,
      confidence: 0.7,
      title: `Value play: ${player.name}`,
      description: `Only ${player.ownership?.toFixed(1)}% owned but projected for ${player.projectedPoints?.toFixed(1)} points`,
      expectedGain: (player.projectedPoints || 0) * 0.1, // Potential upside
      reasoning: [
        `Low ownership (${player.ownership?.toFixed(1)}%)`,
        `Strong projection (${player.projectedPoints?.toFixed(1)} pts)`,
        `Favorable matchup vs ${player.opponent}`
      ],
      action: {
        type: 'monitor',
        playerId: player.id
      },
      tags: ['value', 'sleeper', 'ownership']
    });
  });

  return recommendations;
}

async function generateInjuryRecommendations(currentLineup: LineupSlot[], bench: RosterPlayer[]): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  for (const slot of currentLineup) {
    if (!slot.player) continue;

    if (slot.player.injuryStatus && slot.player.injuryStatus !== 'healthy') {
      const severity = getInjurySeverity(slot.player.injuryStatus);
      
      recommendations.push({
        id: `injury-${slot.player.id}`,
        category: 'injury',
        type: 'injury_alert',
        priority: severity.priority,
        confidence: 0.95,
        title: `${severity.label}: ${slot.player.name}`,
        description: `${slot.player.name} is ${slot.player.injuryStatus} - monitor status leading up to game time`,
        expectedGain: -severity.riskPoints,
        reasoning: [
          `Injury status: ${slot.player.injuryStatus}`,
          `Game time decision risk`,
          `Consider backup options`
        ],
        action: {
          type: 'monitor_injury',
          playerId: slot.player.id,
          checkInterval: severity.checkInterval
        },
        tags: ['injury', 'monitor'],
        severity: slot.player.injuryStatus
      });
    }
  }

  return recommendations;
}

async function generateByeWeekRecommendations(currentLineup: LineupSlot[], bench: RosterPlayer[]): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const currentWeek = getCurrentWeek();

  for (const slot of currentLineup) {
    if (!slot.player) continue;

    if (slot.player.byeWeek === currentWeek) {
      recommendations.push({
        id: `bye-${slot.player.id}`,
        category: 'lineup',
        type: 'bye_week',
        priority: 10, // Critical - will score 0 points
        confidence: 1.0,
        title: `🚨 BYE WEEK: ${slot.player.name}`,
        description: `${slot.player.name} is on bye this week and must be replaced`,
        expectedGain: -(slot.player.projectedPoints || 0),
        reasoning: [
          `Team ${slot.player.team} is on bye week ${currentWeek}`,
          `Will score 0 points if left in lineup`,
          `Must find replacement`
        ],
        action: {
          type: 'replace_required',
          playerId: slot.player.id,
          position: slot.position
        },
        tags: ['bye-week', 'critical', 'lineup']
      });
    }
  }

  return recommendations;
}

async function getWaiverWireSuggestions(league: DatabaseLeagueInfo, players: DatabasePlayerInfo[]): Promise<WaiverWireSuggestion[]> {
  // This would integrate with platform APIs to get available players
  // For now, return mock data
  return [
    {
      id: 'waiver-1',
      player: {
        name: 'Breakout Rookie',
        position: 'WR',
        team: 'LAR',
        projectedPoints: 12.5,
        ownership: 15.2
      },
      priority: 8,
      reasoning: 'Trending up with increased target share',
      action: 'claim'
    },
    {
      id: 'waiver-2',
      player: {
        name: 'Handcuff RB',
        position: 'RB',
        team: 'KC',
        projectedPoints: 8.3,
        ownership: 35.1
      },
      priority: 6,
      reasoning: 'Injury insurance for starter',
      action: 'monitor'
    }
  ];
}

async function getTradeRecommendations(league: DatabaseLeagueInfo, players: DatabasePlayerInfo[], currentLineup: LineupSlot[]): Promise<TradeRecommendation[]> {
  // This would analyze team needs and suggest trades
  // For now, return mock data
  return [
    {
      id: 'trade-1',
      type: 'sell_high',
      player: {
        name: 'Overperforming WR',
        position: 'WR',
        tradeValue: 85
      },
      reasoning: 'Sell high before regression',
      confidence: 0.75
    },
    {
      id: 'trade-2',
      type: 'buy_low',
      player: {
        name: 'Underperforming RB',
        position: 'RB',
        tradeValue: 45
      },
      reasoning: 'Buy low on proven talent',
      confidence: 0.68
    }
  ];
}

async function generateMatchupAnalysis(currentLineup: LineupSlot[], league: DatabaseLeagueInfo): Promise<MatchupAnalysis> {
  const startingPlayers = currentLineup.filter(slot => slot.player).map(slot => slot.player);
  
  return {
    overallRating: 7.2,
    bestMatchups: startingPlayers
      .filter(p => p.matchupRating === 'elite' || p.matchupRating === 'good')
      .slice(0, 3),
    worstMatchups: startingPlayers
      .filter(p => p.matchupRating === 'poor' || p.matchupRating === 'avoid')
      .slice(0, 3),
    weatherConcerns: [],
    gameLogs: startingPlayers.map(player => ({
      player: player.name,
      recent: [12.5, 8.3, 15.7, 6.2], // Last 4 games
      trend: player.trends?.direction || 'stable'
    }))
  };
}

// Utility functions

function canPlayPosition(playerPosition: string, slotPosition: string): boolean {
  if (playerPosition === slotPosition) return true;
  if (slotPosition === 'FLEX' && ['RB', 'WR', 'TE'].includes(playerPosition)) return true;
  if (slotPosition === 'SUPERFLEX' && ['QB', 'RB', 'WR', 'TE'].includes(playerPosition)) return true;
  return false;
}

function calculateStartSitConfidence(currentPlayer: RosterPlayer, alternative: RosterPlayer): number {
  let confidence = 0.5; // Base confidence

  // Factor in projection difference
  const projectionDiff = (alternative.projectedPoints || 0) - (currentPlayer.projectedPoints || 0);
  confidence += Math.min(0.3, projectionDiff * 0.02);

  // Factor in matchup rating
  if (alternative.matchupRating === 'elite') confidence += 0.15;
  if (alternative.matchupRating === 'good') confidence += 0.1;
  if (currentPlayer.matchupRating === 'poor') confidence += 0.1;
  if (currentPlayer.matchupRating === 'avoid') confidence += 0.2;

  // Factor in trends
  if (alternative.trends?.direction === 'up') confidence += 0.1;
  if (currentPlayer.trends?.direction === 'down') confidence += 0.1;

  return Math.min(0.95, Math.max(0.1, confidence));
}

function checkPlayerRedFlags(player: RosterPlayer): string[] {
  const flags: string[] = [];

  if (player.injuryStatus && player.injuryStatus !== 'healthy') {
    flags.push(`${player.injuryStatus} injury status`);
  }

  if (player.byeWeek === getCurrentWeek()) {
    flags.push('On bye week');
  }

  if (player.matchupRating === 'avoid') {
    flags.push('Very difficult matchup');
  }

  if (player.trends?.direction === 'down' && Math.abs(player.trends.weekly) > 20) {
    flags.push('Significant downward trend');
  }

  if (player.isLocked) {
    flags.push('Game already started');
  }

  return flags;
}

function calculateRiskFactors(player: RosterPlayer): RiskFactors {
  let totalRisk = 0;
  const factors: string[] = [];

  // Injury risk
  if (player.injuryStatus === 'questionable') {
    totalRisk += 3;
    factors.push('Questionable injury status (+3 risk)');
  } else if (player.injuryStatus === 'doubtful') {
    totalRisk += 6;
    factors.push('Doubtful injury status (+6 risk)');
  }

  // Matchup difficulty
  if (player.matchupRating === 'poor') {
    totalRisk += 2;
    factors.push('Difficult matchup (+2 risk)');
  } else if (player.matchupRating === 'avoid') {
    totalRisk += 4;
    factors.push('Very difficult matchup (+4 risk)');
  }

  // Performance volatility
  if (player.consistency && player.consistency < 0.6) {
    totalRisk += 2;
    factors.push('High volatility (+2 risk)');
  }

  // Weather concerns (would need actual weather data)
  if (hasWeatherConcerns(player.team)) {
    totalRisk += 1;
    factors.push('Weather concerns (+1 risk)');
  }

  return { totalRisk, factors };
}

function getInjurySeverity(injuryStatus: string): {
  label: string;
  priority: number;
  riskPoints: number;
  checkInterval: string;
}: InjurySeverity {
  switch (injuryStatus) {
    case 'questionable':
      return {
        label: 'Questionable',
        priority: 6,
        riskPoints: 3,
        checkInterval: '1 hour'
      };
    case 'doubtful':
      return {
        label: 'Doubtful',
        priority: 8,
        riskPoints: 6,
        checkInterval: '30 minutes'
      };
    case 'out':
      return {
        label: 'Out',
        priority: 10,
        riskPoints: 10,
        checkInterval: 'game_time'
      };
    case 'ir':
      return {
        label: 'Injured Reserve',
        priority: 10,
        riskPoints: 10,
        checkInterval: 'weekly'
      };
    default:
      return {
        label: 'Unknown',
        priority: 5,
        riskPoints: 2,
        checkInterval: '2 hours'
      };
  }
}

function calculateOverallGrade(lineup: LineupSlot[]): string {
  const totalProjected = lineup.reduce((sum, slot) => sum + (slot.player?.projectedPoints || 0), 0);
  
  if (totalProjected >= 120) return 'A+';
  if (totalProjected >= 110) return 'A';
  if (totalProjected >= 100) return 'B+';
  if (totalProjected >= 90) return 'B';
  if (totalProjected >= 80) return 'C+';
  if (totalProjected >= 70) return 'C';
  if (totalProjected >= 60) return 'D';
  return 'F';
}

function calculateRiskLevel(lineup: LineupSlot[]): 'low' | 'moderate' | 'high' {
  const totalRisk = lineup.reduce((sum, slot) => {
    if (!slot.player) return sum;
    return sum + calculateRiskFactors(slot.player).totalRisk;
  }, 0);

  if (totalRisk <= 10) return 'low';
  if (totalRisk <= 25) return 'moderate';
  return 'high';
}

function calculateProjectedPoints(lineup: LineupSlot[]): number {
  return lineup.reduce((sum, slot) => sum + (slot.player?.projectedPoints || 0), 0);
}

function calculateCeiling(lineup: LineupSlot[]): number {
  return lineup.reduce((sum, slot) => sum + ((slot.player?.projectedPoints || 0) * 1.3), 0);
}

function calculateFloor(lineup: LineupSlot[]): number {
  return lineup.reduce((sum, slot) => sum + ((slot.player?.projectedPoints || 0) * 0.7), 0);
}

function calculateConsistency(lineup: LineupSlot[]): number {
  // Calculate average consistency score
  const consistencyScores = lineup
    .filter(slot => slot.player)
    .map(slot => slot.player.consistency || 0.5);
  
  return consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;
}

function hasWeatherConcerns(team: string): boolean {
  // Would integrate with weather API
  const badWeatherTeams = ['BUF', 'GB', 'CHI', 'NE', 'DEN'];
  return badWeatherTeams.includes(team) && Math.random() > 0.7; // Simplified
}

function getCurrentWeek(): number {
  // Calculate current NFL week
  const startDate = new Date('2024-09-05');
  const now = new Date();
  const weeksSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}

async function getCachedRecommendations(leagueId: string, type: string): Promise<Recommendation[]> {
  // In a real implementation, fetch from Redis or database
  return [];
}

function getUserIdFromRequest(request: NextRequest): string {
  // Extract user ID from JWT token or session
  return 'current-user-id';
}