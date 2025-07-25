import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

// Popular league templates for quick setup
const LEAGUE_TEMPLATES = [
  {
    id: 'standard-redraft',
    name: '🏆 Standard Redraft League',
    description: 'Classic 12-team PPR league with standard settings',
    popularity: 95,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'A classic fantasy football league with standard scoring and roster settings.',
      privacy: 'private' as const,
      leagueType: 'redraft' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 1,
        k: 1,
        def: 1,
        bench: 6,
        ir: 1,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 1,
      waiverProcessing: 'daily' as const,
      tradeDeadline: 'week-12',
      tradeReview: 'commissioner' as const,
      tradeProtests: true,
      confirmed: false,
    }
  },
  
  {
    id: 'superflex-league',
    name: '⚡ SuperFlex League',
    description: 'High-scoring league with SuperFlex position',
    popularity: 85,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'Advanced league format with SuperFlex position for QB premium scoring.',
      privacy: 'private' as const,
      leagueType: 'redraft' as const,
      sport: 'nfl' as const,
      scoringType: 'superflex' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 3,
        te: 1,
        flex: 1,
        superflex: 1,
        k: 1,
        def: 1,
        bench: 7,
        ir: 2,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 1,
      waiverProcessing: 'daily' as const,
      tradeDeadline: 'week-11',
      tradeReview: 'commissioner' as const,
      tradeProtests: true,
      confirmed: false,
    }
  },
  
  {
    id: 'dynasty-league',
    name: '👑 Dynasty League',
    description: 'Long-term dynasty format with rookie drafts',
    popularity: 78,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'Dynasty league focused on long-term roster building and player development.',
      privacy: 'invite-only' as const,
      leagueType: 'dynasty' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 3,
        te: 1,
        flex: 2,
        k: 1,
        def: 1,
        bench: 12,
        ir: 3,
        taxi: 4,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 2,
      waiverProcessing: 'daily' as const,
      tradeDeadline: 'never',
      tradeReview: 'league-vote' as const,
      tradeVotingPeriod: 48,
      tradeProtests: true,
      rookieDraft: true,
      minimumKeepers: 0,
      maximumKeepers: 25,
      confirmed: false,
    }
  },
  
  {
    id: 'auction-league',
    name: '💰 Auction Draft League',
    description: 'Auction draft with $200 budget per team',
    popularity: 72,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'Competitive auction draft league where you bid on your favorite players.',
      privacy: 'private' as const,
      leagueType: 'redraft' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 1,
        k: 1,
        def: 1,
        bench: 6,
        ir: 1,
      },
      draftType: 'auction' as const,
      auctionBudget: 200,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 1,
      waiverProcessing: 'sunday-tuesday' as const,
      tradeDeadline: 'week-12',
      tradeReview: 'commissioner' as const,
      tradeProtests: true,
      confirmed: false,
    }
  },
  
  {
    id: 'keeper-league',
    name: '🔄 Keeper League',
    description: 'Keep 3 players from your previous roster',
    popularity: 68,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'Keeper league allowing you to retain your best players each season.',
      privacy: 'private' as const,
      leagueType: 'keeper' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 1,
        k: 1,
        def: 1,
        bench: 7,
        ir: 2,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 1,
      waiverProcessing: 'daily' as const,
      tradeDeadline: 'week-11',
      tradeReview: 'commissioner' as const,
      tradeProtests: true,
      minimumKeepers: 0,
      maximumKeepers: 3,
      confirmed: false,
    }
  },
  
  {
    id: 'nba-standard',
    name: '🏀 NBA Standard League',
    description: 'Standard NBA fantasy league with daily lineups',
    popularity: 82,
    sport: 'nba',
    settings: {
      name: '',
      description: 'Classic NBA fantasy league with head-to-head matchups.',
      privacy: 'private' as const,
      leagueType: 'redraft' as const,
      sport: 'nba' as const,
      scoringType: 'standard' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 2, // Point Guards
        rb: 2, // Shooting Guards  
        wr: 2, // Small Forwards
        te: 2, // Power Forwards
        flex: 1, // Centers
        k: 0,
        def: 0,
        bench: 4,
        ir: 2,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 23,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 0,
      waiverProcessing: 'daily' as const,
      tradeDeadline: 'week-18',
      tradeReview: 'commissioner' as const,
      tradeProtests: true,
      confirmed: false,
    }
  },
  
  {
    id: 'best-ball',
    name: '🎯 Best Ball League',
    description: 'Draft only - no waiver moves or trades',
    popularity: 75,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'Draft once and done - your best performers automatically start each week.',
      privacy: 'private' as const,
      leagueType: 'redraft' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 12,
      rosterSettings: {
        qb: 2,
        rb: 4,
        wr: 4,
        te: 2,
        flex: 0,
        k: 1,
        def: 1,
        bench: 4,
        ir: 0,
      },
      draftType: 'snake' as const,
      draftOrderType: 'random' as const,
      playoffTeams: 6,
      playoffWeeks: 3,
      championshipWeek: 17,
      playoffSeeding: 'points' as const,
      waiverType: 'free-agent' as const,
      waiverPeriod: 0,
      waiverProcessing: 'manual' as const,
      tradeDeadline: 'never',
      tradeReview: 'none' as const,
      tradeProtests: false,
      confirmed: false,
    }
  },
  
  {
    id: 'high-stakes',
    name: '💎 High Stakes League',
    description: 'Competitive league with advanced settings',
    popularity: 65,
    sport: 'nfl',
    settings: {
      name: '',
      description: 'High-stakes competitive league with advanced roster and scoring settings.',
      privacy: 'invite-only' as const,
      leagueType: 'redraft' as const,
      sport: 'nfl' as const,
      scoringType: 'ppr' as const,
      teamCount: 14,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 3,
        te: 1,
        flex: 2,
        k: 1,
        def: 1,
        bench: 8,
        ir: 3,
      },
      draftType: 'auction' as const,
      auctionBudget: 200,
      draftOrderType: 'random' as const,
      playoffTeams: 8,
      playoffWeeks: 4,
      championshipWeek: 17,
      playoffSeeding: 'record' as const,
      waiverType: 'faab' as const,
      faabBudget: 100,
      waiverPeriod: 2,
      waiverProcessing: 'sunday-tuesday' as const,
      tradeDeadline: 'week-10',
      tradeReview: 'league-vote' as const,
      tradeVotingPeriod: 24,
      tradeProtests: true,
      confirmed: false,
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const leagueType = searchParams.get('type');
    
    let templates = LEAGUE_TEMPLATES;
    
    // Filter by sport if specified
    if (sport) {
      templates = templates.filter(template => template.sport === sport);
    }
    
    // Filter by league type if specified
    if (leagueType) {
      templates = templates.filter(template => template.settings.leagueType === leagueType);
    }
    
    // Sort by popularity
    templates.sort((a, b) => b.popularity - a.popularity);
    
    return NextResponse.json({
      success: true,
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        popularity: template.popularity,
        sport: template.sport,
        leagueType: template.settings.leagueType,
        teamCount: template.settings.teamCount,
        scoringType: template.settings.scoringType,
        draftType: template.settings.draftType,
      }))
    });
    
  } catch (error) {
    logger.error('Template fetch error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { templateId } = await request.json();
    
    const template = LEAGUE_TEMPLATES.find(t => t.id === templateId);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        settings: template.settings
      }
    });
    
  } catch (error) {
    logger.error('Template load error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load template' },
      { status: 500 }
    );
  }
}