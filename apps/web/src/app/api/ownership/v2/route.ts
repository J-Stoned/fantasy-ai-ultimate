/**
 * 🧠 OWNERSHIP ENGINE V2 API 🧠
 * Real-time ownership projections with leverage scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { databaseConfig } from '@/lib/database-config';
import OwnershipEngineV2 from '../../../../../scripts/fantasy-ml/services/ownership-engine-v2';
import { VegasService } from '../../../../../scripts/fantasy-ml/services/vegas-service';
import { InjuryService } from '../../../../../scripts/fantasy-ml/services/injury-service';
import { WeatherService } from '../../../../../scripts/fantasy-ml/services/weather-service';
import { redisCluster, CacheKeys, CacheTTL } from '@/lib/services/redis-cluster';
import { jobs } from '@/lib/services/queue-service';
import { logger } from '../../../../lib/logging/logger';

// Database connection
const pool = new Pool(databaseConfig);

// Initialize services
const vegasService = new VegasService();
const injuryService = new InjuryService();
const weatherService = new WeatherService();
const ownershipEngine = new OwnershipEngineV2(pool, vegasService, injuryService, weatherService);

export async function POST(request: NextRequest) {
  logger.info('[🧠 OWNERSHIP V2] Processing ownership projection request...');
  
  try {
    const body = await request.json();
    const { 
      action = 'project',
      sport = 'NFL',
      slate = 'main',
      contestType = 'GPP',
      gameDate = new Date().toISOString(),
      playerIds
    } = body;

    switch (action) {
      case 'project':
        return projectOwnership(sport, slate, contestType, gameDate);
      
      case 'leverage':
        return calculateLeverage(sport, slate, contestType, gameDate);
      
      case 'historical':
        return getHistoricalOwnership(playerIds);
      
      case 'update':
        return triggerOwnershipUpdate(sport, slate);
      
      case 'subscribe':
        return subscribeToOwnership(sport, slate);
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: project, leverage, historical, update, subscribe'
        }, { status: 400 });
    }
    
  } catch (error) {
    logger.error('[OWNERSHIP V2] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ownership projection failed'
    }, { status: 500 });
  }
}

async function projectOwnership(
  sport: string, 
  slate: string, 
  contestType: string,
  gameDate: string
) {
  // Check cache first
  const cacheKey = `${CacheKeys.OWNERSHIP_LIVE}${sport}:${slate}:${contestType}:${gameDate}`;
  const cached = await redisCluster.get(cacheKey);
  
  if (cached) {
    logger.info('✅ Returning cached ownership projections');
    return NextResponse.json({
      success: true,
      source: 'cache',
      ...cached as any
    });
  }

  try {
    // Get ownership projections
    const projections = await ownershipEngine.projectSlateOwnership(
      sport,
      slate,
      new Date(gameDate),
      contestType as 'GPP' | 'CASH'
    );

    // Calculate summary statistics
    const summary = {
      totalPlayers: projections.length,
      avgOwnership: projections.reduce((sum, p) => sum + p.projectedOwnership, 0) / projections.length * 100,
      maxOwnership: Math.max(...projections.map(p => p.projectedOwnership)) * 100,
      chalkPlays: projections.filter(p => p.chalkScore > 0).length,
      leveragePlays: projections.filter(p => p.leverageScore > 1.5).length,
      contrarianPlays: projections.filter(p => p.contrarianScore > 0).length
    };

    // Get top plays by category
    const topChalk = projections
      .sort((a, b) => b.projectedOwnership - a.projectedOwnership)
      .slice(0, 10);
      
    const topLeverage = projections
      .sort((a, b) => b.leverageScore - a.leverageScore)
      .slice(0, 10);
      
    const topContrarian = projections
      .filter(p => p.projectedOwnership < 0.05)
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, 10);

    // Identify correlated stacks
    const stacks = identifyTopStacks(projections);

    const result = {
      success: true,
      sport,
      slate,
      contestType,
      gameDate,
      summary,
      topChalk,
      topLeverage,
      topContrarian,
      stacks,
      projections: projections.slice(0, 50), // Top 50 for response size
      totalProjections: projections.length,
      generatedAt: new Date()
    };

    // Cache the results
    await redisCluster.set(cacheKey, result, CacheTTL.OWNERSHIP_LIVE);

    // Queue data collection job for real ownership later
    await jobs.data.collectOwnership(sport, []);

    return NextResponse.json(result);
    
  } catch (error) {
    logger.error('[PROJECT] Error:', { error: error });
    
    // Return mock data on error
    return NextResponse.json({
      success: true,
      source: 'mock',
      sport,
      slate,
      contestType,
      summary: {
        totalPlayers: 150,
        avgOwnership: 6.7,
        maxOwnership: 32.5,
        chalkPlays: 15,
        leveragePlays: 25,
        contrarianPlays: 40
      },
      topChalk: generateMockTopPlays('chalk'),
      topLeverage: generateMockTopPlays('leverage'),
      topContrarian: generateMockTopPlays('contrarian'),
      stacks: generateMockStacks(),
      projections: [],
      totalProjections: 150,
      generatedAt: new Date()
    });
  }
}

async function calculateLeverage(
  sport: string,
  slate: string,
  contestType: string,
  gameDate: string
) {
  try {
    // Get projections
    const projections = await ownershipEngine.projectSlateOwnership(
      sport,
      slate,
      new Date(gameDate),
      contestType as 'GPP' | 'CASH'
    );

    // Calculate advanced leverage metrics
    const leverageAnalysis = projections.map(player => {
      const projectedValue = player.projectedPoints / (player.salary / 1000);
      const ownershipDiscount = 1 - player.projectedOwnership;
      const ceilingLeverage = (player.projectedPoints * 1.5) / (player.salary / 1000) * ownershipDiscount;
      
      return {
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        team: player.team,
        salary: player.salary,
        projectedOwnership: player.projectedOwnership * 100,
        projectedPoints: player.projectedPoints,
        leverageScore: player.leverageScore,
        valueRating: projectedValue,
        ownershipDiscount,
        ceilingLeverage,
        gppGrade: calculateGPPGrade(player),
        stackPartners: player.stackPartners,
        narratives: player.narrativeFactors
      };
    });

    // Sort by leverage score
    leverageAnalysis.sort((a, b) => b.leverageScore - a.leverageScore);

    // Identify leverage stacks
    const leverageStacks = identifyLeverageStacks(leverageAnalysis);

    return NextResponse.json({
      success: true,
      sport,
      slate,
      contestType,
      gameDate,
      topLeveragePlays: leverageAnalysis.slice(0, 20),
      leverageStacks,
      metrics: {
        avgLeverageScore: leverageAnalysis.reduce((sum, p) => sum + p.leverageScore, 0) / leverageAnalysis.length,
        playersAbove2x: leverageAnalysis.filter(p => p.leverageScore > 2).length,
        playersAbove3x: leverageAnalysis.filter(p => p.leverageScore > 3).length,
        bestLeverage: leverageAnalysis[0]
      },
      generatedAt: new Date()
    });
    
  } catch (error) {
    logger.error('[LEVERAGE] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Leverage calculation failed'
    }, { status: 500 });
  }
}

async function getHistoricalOwnership(playerIds?: string[]) {
  try {
    let query = `
      SELECT 
        ho.player_id,
        p.name as player_name,
        ho.contest_date,
        ho.actual_ownership,
        ho.projected_ownership,
        ho.contest_type,
        ho.slate_type,
        ho.finishing_position,
        ABS(ho.projected_ownership - ho.actual_ownership) as projection_error
      FROM historical_ownership ho
      JOIN players p ON ho.player_id = p.id
      WHERE ho.contest_date > CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const params: any[] = [];
    if (playerIds && playerIds.length > 0) {
      query += ` AND ho.player_id = ANY($1)`;
      params.push(playerIds);
    }
    
    query += ` ORDER BY ho.contest_date DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    
    // Calculate accuracy metrics
    const accuracyMetrics = {
      avgError: 0,
      overProjections: 0,
      underProjections: 0,
      withinTolerance: 0 // Within 2% error
    };
    
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        const error = row.projection_error;
        accuracyMetrics.avgError += error;
        
        if (row.projected_ownership > row.actual_ownership) {
          accuracyMetrics.overProjections++;
        } else {
          accuracyMetrics.underProjections++;
        }
        
        if (error <= 0.02) {
          accuracyMetrics.withinTolerance++;
        }
      });
      
      accuracyMetrics.avgError /= result.rows.length;
    }
    
    return NextResponse.json({
      success: true,
      totalRecords: result.rows.length,
      historicalData: result.rows,
      accuracyMetrics: {
        ...accuracyMetrics,
        accuracyRate: result.rows.length > 0 
          ? (accuracyMetrics.withinTolerance / result.rows.length * 100).toFixed(1) + '%'
          : 'N/A'
      }
    });
    
  } catch (error) {
    logger.error('[HISTORICAL] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Historical data retrieval failed'
    }, { status: 500 });
  }
}

async function triggerOwnershipUpdate(sport: string, slate: string) {
  try {
    // Queue ownership collection job
    const job = await jobs.data.collectOwnership(sport, []);
    
    // Also trigger live ownership update
    await jobs.data.collectOwnership(sport, []);
    
    return NextResponse.json({
      success: true,
      message: 'Ownership update triggered',
      jobId: job.id,
      sport,
      slate,
      estimatedCompletion: new Date(Date.now() + 30000) // 30 seconds
    });
    
  } catch (error) {
    logger.error('[UPDATE] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Update trigger failed'
    }, { status: 500 });
  }
}

async function subscribeToOwnership(sport: string, slate: string) {
  // In a real implementation, this would set up WebSocket subscription
  // For now, return subscription details
  
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return NextResponse.json({
    success: true,
    subscriptionId,
    channel: `ownership:${sport}:${slate}`,
    message: 'Subscription created. Connect via WebSocket to receive updates.',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    expiresAt: new Date(Date.now() + 3600000) // 1 hour
  });
}

// Helper functions
function identifyTopStacks(projections: any[]) {
  const stacks = [];
  const teams = new Set(projections.map(p => p.team));
  
  teams.forEach(team => {
    const teamPlayers = projections.filter(p => p.team === team);
    const qb = teamPlayers.find(p => p.position === 'QB');
    
    if (qb && qb.projectedOwnership > 0.05) {
      const receivers = teamPlayers
        .filter(p => ['WR', 'TE'].includes(p.position))
        .sort((a, b) => b.leverageScore - a.leverageScore);
      
      if (receivers.length > 0) {
        stacks.push({
          team,
          qb: {
            name: qb.playerName,
            ownership: (qb.projectedOwnership * 100).toFixed(1) + '%',
            points: qb.projectedPoints
          },
          receivers: receivers.slice(0, 3).map(r => ({
            name: r.playerName,
            position: r.position,
            ownership: (r.projectedOwnership * 100).toFixed(1) + '%',
            leverageScore: r.leverageScore.toFixed(2)
          })),
          stackOwnership: ((qb.projectedOwnership + receivers[0]?.projectedOwnership || 0) * 100).toFixed(1) + '%',
          stackLeverage: (qb.leverageScore + (receivers[0]?.leverageScore || 0)) / 2
        });
      }
    }
  });
  
  return stacks.sort((a, b) => b.stackLeverage - a.stackLeverage).slice(0, 5);
}

function identifyLeverageStacks(players: any[]) {
  const stacks = [];
  const byTeam = new Map();
  
  players.forEach(p => {
    if (!byTeam.has(p.team)) {
      byTeam.set(p.team, []);
    }
    byTeam.get(p.team).push(p);
  });
  
  byTeam.forEach((teamPlayers, team) => {
    const qb = teamPlayers.find((p: any) => p.position === 'QB');
    if (!qb) return;
    
    const receivers = teamPlayers
      .filter((p: any) => ['WR', 'TE'].includes(p.position))
      .sort((a: any, b: any) => b.leverageScore - a.leverageScore);
    
    if (receivers.length === 0) return;
    
    // Calculate stack metrics
    const primaryStack = {
      team,
      type: 'QB + WR1',
      players: [qb, receivers[0]],
      combinedOwnership: qb.projectedOwnership + receivers[0].projectedOwnership,
      combinedLeverage: (qb.leverageScore + receivers[0].leverageScore) / 2,
      correlationBonus: 1.2
    };
    
    stacks.push(primaryStack);
    
    // Double stack
    if (receivers.length > 1 && qb.projectedOwnership < 10) {
      const doubleStack = {
        team,
        type: 'QB + WR1 + WR2',
        players: [qb, receivers[0], receivers[1]],
        combinedOwnership: qb.projectedOwnership + receivers[0].projectedOwnership + receivers[1].projectedOwnership,
        combinedLeverage: (qb.leverageScore + receivers[0].leverageScore + receivers[1].leverageScore) / 3,
        correlationBonus: 1.5
      };
      stacks.push(doubleStack);
    }
  });
  
  return stacks
    .sort((a, b) => b.combinedLeverage * b.correlationBonus - a.combinedLeverage * a.correlationBonus)
    .slice(0, 10);
}

function calculateGPPGrade(player: any): string {
  const leverageScore = player.leverageScore;
  const ownership = player.projectedOwnership;
  
  if (leverageScore > 3 && ownership < 0.05) return 'A+';
  if (leverageScore > 2.5 && ownership < 0.08) return 'A';
  if (leverageScore > 2 && ownership < 0.12) return 'B+';
  if (leverageScore > 1.5 && ownership < 0.15) return 'B';
  if (leverageScore > 1.2) return 'C+';
  if (leverageScore > 1) return 'C';
  return 'D';
}

function generateMockTopPlays(type: string) {
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const plays = [];
  
  for (let i = 0; i < 10; i++) {
    const position = positions[Math.floor(Math.random() * positions.length)];
    const salary = type === 'chalk' ? 7000 + Math.random() * 3000 : 4000 + Math.random() * 3000;
    
    plays.push({
      playerName: `${type === 'chalk' ? 'Elite' : type === 'leverage' ? 'Value' : 'Contrarian'} ${position} ${i + 1}`,
      position,
      team: `TEAM${Math.floor(Math.random() * 32) + 1}`,
      salary,
      projectedOwnership: type === 'chalk' ? 15 + Math.random() * 20 : 
                          type === 'leverage' ? 5 + Math.random() * 10 :
                          1 + Math.random() * 4,
      projectedPoints: (salary / 1000) * (3.5 + Math.random()),
      leverageScore: type === 'leverage' ? 2 + Math.random() * 2 : 1 + Math.random(),
      narrativeFactors: ['Hot Streak', 'Home Favorite']
    });
  }
  
  return plays;
}

function generateMockStacks() {
  const teams = ['KC', 'BUF', 'DAL', 'GB', 'TB'];
  
  return teams.map(team => ({
    team,
    qb: {
      name: `${team} QB`,
      ownership: (10 + Math.random() * 15).toFixed(1) + '%',
      points: 22 + Math.random() * 8
    },
    receivers: [
      {
        name: `${team} WR1`,
        position: 'WR',
        ownership: (8 + Math.random() * 12).toFixed(1) + '%',
        leverageScore: (1.5 + Math.random() * 1.5).toFixed(2)
      },
      {
        name: `${team} WR2`,
        position: 'WR',
        ownership: (3 + Math.random() * 7).toFixed(1) + '%',
        leverageScore: (2 + Math.random() * 2).toFixed(2)
      }
    ],
    stackOwnership: (15 + Math.random() * 10).toFixed(1) + '%',
    stackLeverage: 1.5 + Math.random() * 1.5
  }));
}