import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '../../../../lib/logging/logger';

// Validation schema for league creation
const createLeagueSchema = z.object({
  // League Basics
  name: z.string().min(1, 'League name is required').max(50, 'League name too long'),
  description: z.string().optional(),
  privacy: z.enum(['public', 'private', 'invite-only']),
  password: z.string().optional(),
  
  // League Type
  leagueType: z.enum(['redraft', 'keeper', 'dynasty', 'salary-cap', 'idp']),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl']),
  
  // Scoring System
  scoringType: z.enum(['standard', 'ppr', 'half-ppr', 'custom', 'superflex']),
  customScoring: z.record(z.number()).optional(),
  
  // Roster Settings
  teamCount: z.number().min(4).max(20),
  rosterSettings: z.object({
    qb: z.number().min(0).max(3),
    rb: z.number().min(0).max(4),
    wr: z.number().min(0).max(4),
    te: z.number().min(0).max(3),
    flex: z.number().min(0).max(4),
    superflex: z.number().min(0).max(2).optional(),
    k: z.number().min(0).max(2),
    def: z.number().min(0).max(2),
    bench: z.number().min(3).max(12),
    ir: z.number().min(0).max(4),
    taxi: z.number().min(0).max(6).optional(),
  }),
  
  // Draft Settings
  draftType: z.enum(['snake', 'auction', 'linear']),
  draftDate: z.string().datetime().optional(),
  draftTime: z.string().optional(),
  draftOrderType: z.enum(['random', 'custom']),
  auctionBudget: z.number().min(100).max(1000).optional(),
  
  // Playoff Settings
  playoffTeams: z.number().min(2).max(12),
  playoffWeeks: z.number().min(1).max(4),
  championshipWeek: z.number().min(14).max(18),
  playoffSeeding: z.enum(['record', 'points', 'h2h']),
  
  // Waiver Settings
  waiverType: z.enum(['faab', 'priority', 'free-agent']),
  faabBudget: z.number().min(50).max(500).optional(),
  waiverPeriod: z.number().min(0).max(7),
  waiverProcessing: z.enum(['daily', 'sunday-tuesday', 'manual']),
  
  // Trade Settings
  tradeDeadline: z.string(),
  tradeReview: z.enum(['commissioner', 'league-vote', 'none']),
  tradeVotingPeriod: z.number().min(12).max(168).optional(),
  tradeProtests: z.boolean(),
  
  // Advanced Rules
  rookieDraft: z.boolean().optional(),
  contractSystem: z.boolean().optional(),
  salaryRetention: z.number().min(0).max(100).optional(),
  minimumKeepers: z.number().min(0).max(10).optional(),
  maximumKeepers: z.number().min(1).max(15).optional(),
  
  confirmed: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data
    const validatedData = createLeagueSchema.parse(body);
    
    // Additional business logic validation
    if (validatedData.privacy === 'private' && !validatedData.password) {
      return NextResponse.json(
        { error: 'Password required for private leagues' },
        { status: 400 }
      );
    }
    
    if (validatedData.playoffTeams >= validatedData.teamCount) {
      return NextResponse.json(
        { error: 'Playoff teams must be less than total teams' },
        { status: 400 }
      );
    }
    
    if (validatedData.draftType === 'auction' && !validatedData.auctionBudget) {
      return NextResponse.json(
        { error: 'Auction budget required for auction drafts' },
        { status: 400 }
      );
    }
    
    if (validatedData.waiverType === 'faab' && !validatedData.faabBudget) {
      return NextResponse.json(
        { error: 'FAAB budget required for FAAB waiver system' },
        { status: 400 }
      );
    }
    
    // Generate unique league ID
    const leagueId = generateLeagueId();
    
    // Create league object
    const league = {
      id: leagueId,
      ...validatedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'setup', // setup, drafting, active, completed
      currentWeek: 1,
      season: new Date().getFullYear(),
      commissionerId: 'temp-user-id', // TODO: Get from auth
      managers: [],
      inviteCode: generateInviteCode(),
      draftOrder: validatedData.draftOrderType === 'random' ? 
        generateRandomDraftOrder(validatedData.teamCount) : [],
      
      // Initialize additional league data
      standings: [],
      schedule: [],
      waiverClaims: [],
      trades: [],
      settings: {
        ...validatedData,
        lockTime: calculateLockTime(validatedData.sport),
        scoringPeriods: getScoringPeriods(validatedData.sport),
        positionLimits: calculatePositionLimits(validatedData.rosterSettings),
      }
    };
    
    // TODO: Save to database
    // await saveLeagueToDatabase(league);
    
    // For now, simulate database save with timeout
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return success response
    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        sport: league.sport,
        leagueType: league.leagueType,
        teamCount: league.teamCount,
        status: league.status,
      }
    });
    
  } catch (error) {
    logger.error('League creation error:', { error: error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid league settings',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create league. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper functions
function generateLeagueId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomDraftOrder(teamCount: number): number[] {
  const order = Array.from({ length: teamCount }, (_, i) => i + 1);
  
  // Fisher-Yates shuffle
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  
  return order;
}

function calculateLockTime(sport: string): string {
  const lockTimes = {
    nfl: '13:00', // 1 PM ET Sunday
    nba: '19:00', // 7 PM ET game time
    mlb: '19:00', // 7 PM ET game time
    nhl: '19:00', // 7 PM ET game time
  };
  
  return lockTimes[sport as keyof typeof lockTimes] || '13:00';
}

function getScoringPeriods(sport: string): { start: number; end: number } {
  const periods = {
    nfl: { start: 1, end: 18 },
    nba: { start: 1, end: 82 },
    mlb: { start: 1, end: 162 },
    nhl: { start: 1, end: 82 },
  };
  
  return periods[sport as keyof typeof periods] || { start: 1, end: 17 };
}

function calculatePositionLimits(rosterSettings: any): Record<string, number> {
  return {
    QB: rosterSettings.qb + (rosterSettings.superflex || 0),
    RB: rosterSettings.rb + rosterSettings.flex + (rosterSettings.superflex || 0),
    WR: rosterSettings.wr + rosterSettings.flex + (rosterSettings.superflex || 0),
    TE: rosterSettings.te + rosterSettings.flex + (rosterSettings.superflex || 0),
    K: rosterSettings.k,
    DEF: rosterSettings.def,
  };
}