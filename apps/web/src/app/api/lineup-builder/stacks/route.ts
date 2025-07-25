import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

interface StackRequest {
  sport: string;
  stackType: string;
  currentLineup: string[];
}

interface StackRecommendation {
  type: string;
  players: {
    player_id: string;
    name: string;
    position: string;
    team: string;
    projected_points: number;
    salary: number;
    correlation_score: number;
  }[];
  total_projection: number;
  total_salary: number;
  correlation_strength: number;
  narrative: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body: StackRequest = await request.json();
    const { sport, stackType, currentLineup } = body;

    // Fetch current player pool
    const playersResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lineup-builder/players?sport=${sport}`,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!playersResponse.ok) {
      throw new Error('Failed to fetch player data');
    }

    const playersData = await playersResponse.json();
    const players = playersData.players || [];

    // Generate stack recommendations based on type
    const recommendations = await generateStackRecommendations(
      players,
      stackType,
      currentLineup,
      sport
    );

    return NextResponse.json({
      success: true,
      recommendations,
      meta: {
        stack_type: stackType,
        sport,
        total_recommendations: recommendations.length,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Stack recommendations error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate stack recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generateStackRecommendations(
  players: any[],
  stackType: string,
  currentLineup: string[],
  sport: string
): Promise<StackRecommendation[]> {
  const recommendations: StackRecommendation[] = [];
  const playersInLineup = new Set(currentLineup);

  switch (stackType) {
    case 'qb-wr':
      recommendations.push(...generateQBWRStacks(players, playersInLineup));
      break;
      
    case 'rb-dst':
      recommendations.push(...generateRBDSTStacks(players, playersInLineup));
      break;
      
    case 'game-stack':
      recommendations.push(...generateGameStacks(players, playersInLineup));
      break;
      
    case 'custom':
      // Generate multiple stack types for custom analysis
      recommendations.push(
        ...generateQBWRStacks(players, playersInLineup),
        ...generateRBDSTStacks(players, playersInLineup),
        ...generateGameStacks(players, playersInLineup),
        ...generateTeamStacks(players, playersInLineup)
      );
      break;
      
    default:
      recommendations.push(...generateQBWRStacks(players, playersInLineup));
  }

  // Sort by correlation strength and projected points
  recommendations.sort((a, b) => 
    (b.correlation_strength * b.total_projection) - (a.correlation_strength * a.total_projection)
  );

  // Return top 15 recommendations
  return recommendations.slice(0, 15);
}

function generateQBWRStacks(players: any[], playersInLineup: Set<string>): StackRecommendation[] {
  const stacks: StackRecommendation[] = [];
  const qbs = players.filter(p => p.position === 'QB' && !playersInLineup.has(p.player_id));
  const wrs = players.filter(p => p.position === 'WR' && !playersInLineup.has(p.player_id));

  qbs.forEach(qb => {
    // Find WRs from same team
    const teamWRs = wrs.filter(wr => wr.team === qb.team);
    
    teamWRs.forEach(wr => {
      if (qb.projected_points + wr.projected_points > 25) { // Minimum threshold
        const correlationScore = calculateQBWRCorrelation(qb, wr);
        
        stacks.push({
          type: 'QB-WR',
          players: [
            {
              player_id: qb.player_id,
              name: qb.name,
              position: qb.position,
              team: qb.team,
              projected_points: qb.projected_points,
              salary: qb.salary,
              correlation_score: correlationScore
            },
            {
              player_id: wr.player_id,
              name: wr.name,
              position: wr.position,
              team: wr.team,
              projected_points: wr.projected_points,
              salary: wr.salary,
              correlation_score: correlationScore
            }
          ],
          total_projection: qb.projected_points + wr.projected_points,
          total_salary: qb.salary + wr.salary,
          correlation_strength: correlationScore,
          narrative: generateStackNarrative('QB-WR', qb, wr),
          priority: correlationScore > 0.7 ? 'high' : correlationScore > 0.5 ? 'medium' : 'low'
        });
      }
    });
  });

  return stacks;
}

function generateRBDSTStacks(players: any[], playersInLineup: Set<string>): StackRecommendation[] {
  const stacks: StackRecommendation[] = [];
  const rbs = players.filter(p => p.position === 'RB' && !playersInLineup.has(p.player_id));
  const dsts = players.filter(p => p.position === 'DST' && !playersInLineup.has(p.player_id));

  rbs.forEach(rb => {
    // Find DST from same team (positive game script)
    const teamDST = dsts.find(dst => dst.team === rb.team);
    
    if (teamDST && rb.projected_points > 12) { // RB must be projected well
      const correlationScore = calculatePositiveGameScriptCorrelation(rb, teamDST);
      
      stacks.push({
        type: 'RB-DST',
        players: [
          {
            player_id: rb.player_id,
            name: rb.name,
            position: rb.position,
            team: rb.team,
            projected_points: rb.projected_points,
            salary: rb.salary,
            correlation_score: correlationScore
          },
          {
            player_id: teamDST.player_id,
            name: teamDST.name,
            position: teamDST.position,
            team: teamDST.team,
            projected_points: teamDST.projected_points,
            salary: teamDST.salary,
            correlation_score: correlationScore
          }
        ],
        total_projection: rb.projected_points + teamDST.projected_points,
        total_salary: rb.salary + teamDST.salary,
        correlation_strength: correlationScore,
        narrative: generateStackNarrative('RB-DST', rb, teamDST),
        priority: correlationScore > 0.6 ? 'high' : correlationScore > 0.4 ? 'medium' : 'low'
      });
    }
  });

  return stacks;
}

function generateGameStacks(players: any[], playersInLineup: Set<string>): StackRecommendation[] {
  const stacks: StackRecommendation[] = [];
  
  // Group players by game (team vs opponent)
  const games = new Map<string, any[]>();
  
  players.forEach(player => {
    if (playersInLineup.has(player.player_id)) return;
    
    const gameKey = [player.team, player.opponent].sort().join('-');
    if (!games.has(gameKey)) {
      games.set(gameKey, []);
    }
    games.get(gameKey)!.push(player);
  });

  games.forEach((gamePlayers, gameKey) => {
    const [team1, team2] = gameKey.split('-');
    
    // Find high-scoring players from both teams
    const team1Players = gamePlayers
      .filter(p => p.team === team1 && p.projected_points > 10)
      .sort((a, b) => b.projected_points - a.projected_points)
      .slice(0, 2);
      
    const team2Players = gamePlayers
      .filter(p => p.team === team2 && p.projected_points > 10)
      .sort((a, b) => b.projected_points - a.projected_points)
      .slice(0, 2);

    if (team1Players.length > 0 && team2Players.length > 0) {
      const stackPlayers = [...team1Players, ...team2Players];
      const totalProjection = stackPlayers.reduce((sum, p) => sum + p.projected_points, 0);
      const totalSalary = stackPlayers.reduce((sum, p) => sum + p.salary, 0);
      
      if (totalProjection > 40) { // Minimum threshold for game stack
        const correlationScore = calculateGameStackCorrelation(stackPlayers);
        
        stacks.push({
          type: 'Game Stack',
          players: stackPlayers.map(p => ({
            player_id: p.player_id,
            name: p.name,
            position: p.position,
            team: p.team,
            projected_points: p.projected_points,
            salary: p.salary,
            correlation_score: correlationScore
          })),
          total_projection: totalProjection,
          total_salary: totalSalary,
          correlation_strength: correlationScore,
          narrative: `High-scoring ${team1} vs ${team2} game with ${totalProjection.toFixed(1)} projected points`,
          priority: correlationScore > 0.6 ? 'high' : 'medium'
        });
      }
    }
  });

  return stacks;
}

function generateTeamStacks(players: any[], playersInLineup: Set<string>): StackRecommendation[] {
  const stacks: StackRecommendation[] = [];
  
  // Group by team
  const teams = new Map<string, any[]>();
  players.forEach(player => {
    if (playersInLineup.has(player.player_id)) return;
    
    if (!teams.has(player.team)) {
      teams.set(player.team, []);
    }
    teams.get(player.team)!.push(player);
  });

  teams.forEach((teamPlayers, team) => {
    // Find QB + multiple pass catchers
    const qb = teamPlayers.find(p => p.position === 'QB');
    const passCatchers = teamPlayers
      .filter(p => (p.position === 'WR' || p.position === 'TE') && p.projected_points > 8)
      .sort((a, b) => b.projected_points - a.projected_points)
      .slice(0, 2);

    if (qb && passCatchers.length >= 2) {
      const stackPlayers = [qb, ...passCatchers];
      const totalProjection = stackPlayers.reduce((sum, p) => sum + p.projected_points, 0);
      const totalSalary = stackPlayers.reduce((sum, p) => sum + p.salary, 0);
      
      if (totalProjection > 35) {
        const correlationScore = calculateTeamStackCorrelation(stackPlayers);
        
        stacks.push({
          type: 'Team Stack',
          players: stackPlayers.map(p => ({
            player_id: p.player_id,
            name: p.name,
            position: p.position,
            team: p.team,
            projected_points: p.projected_points,
            salary: p.salary,
            correlation_score: correlationScore
          })),
          total_projection: totalProjection,
          total_salary: totalSalary,
          correlation_strength: correlationScore,
          narrative: `${team} passing attack stack with ${stackPlayers.map(p => p.name).join(', ')}`,
          priority: correlationScore > 0.7 ? 'high' : 'medium'
        });
      }
    }
  });

  return stacks;
}

function calculateQBWRCorrelation(qb: any, wr: any): number {
  // Base correlation for QB-WR from same team
  let correlation = 0.65;
  
  // Adjust based on target share (if available)
  if (wr.target_share && wr.target_share > 0.25) {
    correlation += 0.15;
  }
  
  // Adjust based on red zone usage
  if (wr.red_zone_targets && wr.red_zone_targets > 3) {
    correlation += 0.1;
  }
  
  // Adjust based on Vegas total
  if (qb.vegas_total && qb.vegas_total > 47) {
    correlation += 0.05;
  }
  
  return Math.min(0.9, correlation);
}

function calculatePositiveGameScriptCorrelation(rb: any, dst: any): number {
  // RB and DST benefit from positive game script (team winning)
  let correlation = 0.5;
  
  // Adjust based on spread (favored teams more likely to run and get defensive stats)
  if (rb.spread && rb.spread > 3) {
    correlation += 0.2;
  }
  
  // Adjust based on RB usage
  if (rb.carries_projection && rb.carries_projection > 18) {
    correlation += 0.1;
  }
  
  return Math.min(0.8, correlation);
}

function calculateGameStackCorrelation(players: any[]): number {
  // High-scoring games benefit all players
  const avgVegasTotal = players.reduce((sum, p) => sum + (p.vegas_total || 45), 0) / players.length;
  
  let correlation = 0.4;
  
  if (avgVegasTotal > 50) {
    correlation += 0.2;
  } else if (avgVegasTotal > 47) {
    correlation += 0.1;
  }
  
  return Math.min(0.7, correlation);
}

function calculateTeamStackCorrelation(players: any[]): number {
  // QB + multiple receivers highly correlated
  let correlation = 0.7;
  
  // More receivers = higher correlation potential
  const receiverCount = players.filter(p => p.position === 'WR' || p.position === 'TE').length;
  if (receiverCount > 2) {
    correlation += 0.1;
  }
  
  return Math.min(0.85, correlation);
}

function generateStackNarrative(stackType: string, player1: any, player2: any): string {
  const narratives = {
    'QB-WR': [
      `${player1.name} to ${player2.name} connection has been hot`,
      `${player2.name} is ${player1.name}'s favorite red zone target`,
      `High-volume passing game expected for ${player1.team}`,
      `${player2.name} should see increased targets with ${player1.name} under center`
    ],
    'RB-DST': [
      `${player1.team} expected to control game flow with ${player1.name} carrying the load`,
      `Positive game script benefits both ${player1.name} and ${player1.team} defense`,
      `${player1.name} should see heavy usage if ${player1.team} takes an early lead`,
      `Game environment favors running game and defensive opportunities`
    ]
  };
  
  const options = narratives[stackType as keyof typeof narratives] || ['Strong correlation opportunity'];
  return options[Math.floor(Math.random() * options.length)];
}