import { NextRequest, NextResponse } from 'next/server';
import { LeagueDatabaseService } from '../../../../lib/services/league-database-service';
import type { 
  YahooApiResponse, 
  YahooGame, 
  YahooLeagueWrapper,
  ESPNLeague,
  ESPNTeam,
  SleeperLeague,
  SleeperUser
} from '../../../../types/external-apis';
import type { League } from '../../../../types/api';
import { logger } from '../../../../../lib/logging/logger';

// Platform-specific API endpoints
const PLATFORM_APIS = {
  yahoo: 'https://fantasysports.yahooapis.com/fantasy/v2',
  espn: 'https://fantasy.espn.com/apis/v3',
  sleeper: 'https://api.sleeper.app/v1',
  cbs: 'https://api.cbssports.com/fantasy',
  draftkings: 'https://api.draftkings.com',
  fanduel: 'https://api.fanduel.com',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const dbService = new LeagueDatabaseService();
  
  try {
    const platform = params.platform;
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Platform-specific league fetching
    let leagues: Partial<League>[] = [];
    
    switch (platform) {
      case 'yahoo':
        leagues = await fetchYahooLeagues(token);
        break;
      case 'espn':
        leagues = await fetchESPNLeagues(token);
        break;
      case 'sleeper':
        leagues = await fetchSleeperLeagues(token);
        break;
      case 'cbs':
        leagues = await fetchCBSLeagues(token);
        break;
      case 'draftkings':
        leagues = await fetchDraftKingsContests(token);
        break;
      case 'fanduel':
        leagues = await fetchFanDuelContests(token);
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported platform' },
          { status: 400 }
        );
    }
    
    // Save leagues to database
    const savedLeagues = [];
    for (const league of leagues) {
      try {
        const dbLeague = {
          id: `${platform}_${league.id}`,
          platform_id: String(league.id),
          platform,
          name: league.name,
          sport: league.sport,
          season: String(league.season),
          team_count: league.teamCount || 12,
          scoring_type: league.scoringType || 'standard',
          is_active: league.isActive !== false,
          my_team_id: league.myTeamId,
          my_team_name: league.myTeamName,
          current_standing: league.currentStanding,
          settings: league.settings || {},
          last_synced: new Date()
        };
        
        const saved = await dbService.saveLeague(dbLeague);
        savedLeagues.push({
          ...league,
          id: saved.id,
          lastSynced: saved.last_synced
        });
      } catch (dbError) {
        logger.warn(`Failed to save league ${league.id}:`, dbError);
        // Still return the league even if DB save fails
        savedLeagues.push(league);
      }
    }
    
    return NextResponse.json(savedLeagues);
  } catch (error) {
    logger.error('Error fetching ${params.platform} leagues:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch leagues' },
      { status: 500 }
    );
  }
}

async function fetchYahooLeagues(token: string): Promise<Partial<League>[]> {
  try {
    // Yahoo uses XML responses, so we need to parse them
    const response = await fetch(
      `${PLATFORM_APIS.yahoo}/users;use_login=1/games;game_keys=nfl,nba,mlb,nhl/leagues?format=json`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Yahoo API request failed');
    }
    
    const data: YahooApiResponse = await response.json();
    
    // Parse Yahoo's nested response structure
    const leagues = [];
    const games = data.fantasy_content?.users?.[0]?.user?.[1]?.games;
    
    if (games) {
      Object.values(games).forEach((game: YahooGame) => {
        if (game.leagues) {
          Object.values(game.leagues).forEach((league: YahooLeagueWrapper) => {
            if (league.league) {
              leagues.push({
                id: league.league[0].league_key,
                name: league.league[0].name,
                sport: mapYahooSport(game.game_key),
                season: league.league[0].season,
                teamCount: league.league[0].num_teams,
                scoringType: league.league[0].scoring_type,
                isActive: league.league[0].is_finished === '0',
                myTeamId: league.league[1]?.teams?.[0]?.team?.[0]?.team_key,
                myTeamName: league.league[1]?.teams?.[0]?.team?.[0]?.name,
                currentStanding: league.league[1]?.teams?.[0]?.team?.[1]?.team_standings?.rank,
              });
            }
          });
        }
      });
    }
    
    return leagues;
  } catch (error) {
    logger.error('Yahoo leagues fetch error:', { error: error });
    throw error;
  }
}

async function fetchESPNLeagues(token: string): Promise<Partial<League>[]> {
  try {
    // ESPN uses cookies for auth, token would be the swid cookie value
    const response = await fetch(
      `${PLATFORM_APIS.espn}/games/ffl/seasons/2024/segments/0/leagues`,
      {
        headers: {
          'Cookie': `SWID=${token}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('ESPN API request failed');
    }
    
    const data: ESPNLeague[] = await response.json();
    
    return data.map((league: ESPNLeague) => ({
      id: league.id,
      name: league.settings.name,
      sport: 'nfl', // ESPN endpoint is sport-specific
      season: '2024',
      teamCount: league.settings.size,
      scoringType: league.settings.scoringType,
      isActive: true,
      myTeamId: league.teams?.find((t: ESPNTeam) => t.owners?.includes(token))?.id,
    }));
  } catch (error) {
    logger.error('ESPN leagues fetch error:', { error: error });
    throw error;
  }
}

async function fetchSleeperLeagues(username: string): Promise<Partial<League>[]> {
  try {
    // Sleeper uses username-based API
    const userResponse = await fetch(
      `${PLATFORM_APIS.sleeper}/user/${username}`
    );
    
    if (!userResponse.ok) {
      throw new Error('Sleeper user fetch failed');
    }
    
    const user: SleeperUser = await userResponse.json();
    
    // Get user's leagues
    const leaguesResponse = await fetch(
      `${PLATFORM_APIS.sleeper}/user/${user.user_id}/leagues/nfl/2024`
    );
    
    if (!leaguesResponse.ok) {
      throw new Error('Sleeper leagues fetch failed');
    }
    
    const leagues: SleeperLeague[] = await leaguesResponse.json();
    
    return leagues.map((league: SleeperLeague) => ({
      id: league.league_id,
      name: league.name,
      sport: league.sport,
      season: league.season,
      teamCount: league.total_rosters,
      scoringType: league.scoring_settings?.type || 'standard',
      isActive: league.status === 'in_season',
      myTeamId: league.roster_id,
    }));
  } catch (error) {
    logger.error('Sleeper leagues fetch error:', { error: error });
    throw error;
  }
}

async function fetchCBSLeagues(token: string): Promise<Partial<League>[]> {
  // CBS implementation would go here
  // This is a placeholder as CBS API details vary
  return [
    {
      id: 'cbs_demo_1',
      name: 'CBS Demo League',
      sport: 'nfl',
      season: '2024',
      teamCount: 12,
      scoringType: 'standard',
      isActive: true,
    },
  ];
}

async function fetchDraftKingsContests(token: string): Promise<Partial<League>[]> {
  // DraftKings DFS contests
  return [
    {
      id: 'dk_contest_1',
      name: 'NFL $3M Fantasy Football Millionaire',
      sport: 'nfl',
      season: '2024',
      teamCount: 150000,
      scoringType: 'dfs',
      isActive: true,
      contestType: 'gpp',
      entryFee: 20,
      prizePool: 3000000,
    },
  ];
}

async function fetchFanDuelContests(token: string): Promise<Partial<League>[]> {
  // FanDuel DFS contests
  return [
    {
      id: 'fd_contest_1',
      name: 'NFL Sunday Million',
      sport: 'nfl',
      season: '2024',
      teamCount: 200000,
      scoringType: 'dfs',
      isActive: true,
      contestType: 'gpp',
      entryFee: 5,
      prizePool: 1000000,
    },
  ];
}

function mapYahooSport(gameKey: string): string {
  const sportMap: Record<string, string> = {
    'nfl': 'nfl',
    'nba': 'nba',
    'mlb': 'mlb',
    'nhl': 'nhl',
  };
  
  const sport = gameKey.split('.')[0];
  return sportMap[sport] || sport;
}