import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

interface PlayerPoolRequest {
  sport: string;
  platform: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'nfl';
    const platform = searchParams.get('platform') || 'draftkings';

    // Fetch player predictions from the existing API
    const predictionsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/predictions?sport=${sport}&platform=${platform}`,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!predictionsResponse.ok) {
      throw new Error(`Failed to fetch predictions: ${predictionsResponse.statusText}`);
    }

    const predictionsData = await predictionsResponse.json();

    if (!predictionsData.success) {
      throw new Error('Predictions API returned error');
    }

    // Transform predictions into lineup builder format
    const players = predictionsData.predictions?.map((p: any) => ({
      player_id: p.player_id || `${p.name}_${p.team}_${Date.now()}`,
      name: p.name,
      position: p.position,
      team: p.team,
      opponent: p.opponent,
      salary: p.salary,
      projected_points: p.projected_points,
      floor: p.floor || p.projected_points * 0.75,
      ceiling: p.ceiling || p.projected_points * 1.35,
      ownership_projection: p.ownership_projection || Math.random() * 0.3, // Fallback
      leverage_score: calculateLeverageScore(p.projected_points, p.ownership_projection || 0.15, p.salary),
      value_rating: p.projected_points / (p.salary / 1000),
      injury_status: p.injury_status,
      game_time: p.game_time,
      weather_impact: p.weather_impact,
      vegas_total: p.vegas_total,
      spread: p.spread,
      stack_partners: generateStackPartners(p, predictionsData.predictions || [])
    })) || [];

    // Sort players by value rating (points per $1000 salary)
    players.sort((a: any, b: any) => b.value_rating - a.value_rating);

    // Add position-specific enhancements
    const enhancedPlayers = enhancePlayersForLineupBuilder(players, sport, platform);

    return NextResponse.json({
      success: true,
      players: enhancedPlayers,
      meta: {
        total_players: enhancedPlayers.length,
        sport,
        platform,
        last_updated: new Date().toISOString(),
        positions: getPositionCounts(enhancedPlayers),
        salary_range: getSalaryRange(enhancedPlayers),
        projection_range: getProjectionRange(enhancedPlayers)
      }
    });

  } catch (error) {
    logger.error('Player pool fetch error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch player pool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateLeverageScore(projectedPoints: number, ownership: number, salary: number): number {
  // Leverage = (Projected Points / Salary) / (Ownership Percentage + 0.01)
  // Higher leverage means better value relative to ownership
  const pointsPerDollar = projectedPoints / (salary / 1000);
  const leverageScore = pointsPerDollar / ((ownership * 100) + 1);
  return Math.max(0.1, Math.min(10, leverageScore)); // Cap between 0.1 and 10
}

function generateStackPartners(player: any, allPlayers: any[]): string[] {
  const partners: string[] = [];
  
  // For QB, find WRs and TEs from same team
  if (player.position === 'QB') {
    const teammates = allPlayers.filter(p => 
      p.team === player.team && 
      (p.position === 'WR' || p.position === 'TE') &&
      p.name !== player.name
    );
    partners.push(...teammates.slice(0, 3).map(p => p.name));
  }
  
  // For WR/TE, find QB from same team
  if (player.position === 'WR' || player.position === 'TE') {
    const qb = allPlayers.find(p => 
      p.team === player.team && 
      p.position === 'QB' &&
      p.name !== player.name
    );
    if (qb) partners.push(qb.name);
  }
  
  // For RB, find DST from same team
  if (player.position === 'RB') {
    const dst = allPlayers.find(p => 
      p.team === player.team && 
      p.position === 'DST' &&
      p.name !== player.name
    );
    if (dst) partners.push(dst.name);
  }
  
  // For opposing team players (game stack opportunities)
  const opposingPlayers = allPlayers.filter(p => 
    p.team === player.opponent && 
    p.projected_points > 10 // Only high-scoring opposing players
  );
  partners.push(...opposingPlayers.slice(0, 2).map(p => p.name));
  
  return partners;
}

function enhancePlayersForLineupBuilder(players: any[], sport: string, platform: string): any[] {
  return players.map(player => {
    // Add platform-specific adjustments
    if (platform === 'fanduel') {
      // FanDuel typically has different scoring
      player.projected_points *= 1.05; // Slight adjustment for FD scoring
    }
    
    // Add sport-specific enhancements
    switch (sport) {
      case 'nfl':
        // Add weather impact for outdoor games
        if (player.weather_impact && player.weather_impact < 0.5) {
          player.projected_points *= 0.95; // Reduce for bad weather
        }
        break;
        
      case 'nba':
        // Add rest days impact
        player.rest_advantage = Math.random() > 0.7; // Simulate rest advantage
        if (player.rest_advantage) {
          player.projected_points *= 1.08;
        }
        break;
        
      case 'mlb':
        // Add ballpark factors
        player.ballpark_factor = 0.95 + (Math.random() * 0.1); // 0.95 to 1.05
        player.projected_points *= player.ballpark_factor;
        break;
        
      case 'nhl':
        // Add line combinations
        player.line_number = Math.floor(Math.random() * 4) + 1; // Lines 1-4
        if (player.line_number === 1) {
          player.projected_points *= 1.1; // Boost for top line
        }
        break;
    }
    
    // Recalculate derived stats after adjustments
    player.value_rating = player.projected_points / (player.salary / 1000);
    player.leverage_score = calculateLeverageScore(
      player.projected_points, 
      player.ownership_projection, 
      player.salary
    );
    
    return player;
  });
}

function getPositionCounts(players: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  players.forEach(p => {
    counts[p.position] = (counts[p.position] || 0) + 1;
  });
  return counts;
}

function getSalaryRange(players: any[]): { min: number; max: number; avg: number } {
  const salaries = players.map(p => p.salary);
  return {
    min: Math.min(...salaries),
    max: Math.max(...salaries),
    avg: Math.round(salaries.reduce((sum, s) => sum + s, 0) / salaries.length)
  };
}

function getProjectionRange(players: any[]): { min: number; max: number; avg: number } {
  const projections = players.map(p => p.projected_points);
  return {
    min: Math.min(...projections),
    max: Math.max(...projections),
    avg: Math.round((projections.reduce((sum, p) => sum + p, 0) / projections.length) * 10) / 10
  };
}