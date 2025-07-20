import { NextRequest, NextResponse } from 'next/server';

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
    let leagues = [];
    
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
    
    return NextResponse.json(leagues);
  } catch (error) {
    console.error(`Error fetching ${params.platform} leagues:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch leagues' },
      { status: 500 }
    );
  }
}

async function fetchYahooLeagues(token: string) {
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
    
    const data = await response.json();
    
    // Parse Yahoo's nested response structure
    const leagues = [];
    const games = data.fantasy_content?.users?.[0]?.user?.[1]?.games;
    
    if (games) {
      Object.values(games).forEach((game: any) => {
        if (game.leagues) {
          Object.values(game.leagues).forEach((league: any) => {
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
    console.error('Yahoo leagues fetch error:', error);
    throw error;
  }
}

async function fetchESPNLeagues(token: string) {
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
    
    const data = await response.json();
    
    return data.map((league: any) => ({
      id: league.id,
      name: league.settings.name,
      sport: 'nfl', // ESPN endpoint is sport-specific
      season: '2024',
      teamCount: league.settings.size,
      scoringType: league.settings.scoringType,
      isActive: true,
      myTeamId: league.teams?.find((t: any) => t.owners?.includes(token))?.id,
    }));
  } catch (error) {
    console.error('ESPN leagues fetch error:', error);
    throw error;
  }
}

async function fetchSleeperLeagues(username: string) {
  try {
    // Sleeper uses username-based API
    const userResponse = await fetch(
      `${PLATFORM_APIS.sleeper}/user/${username}`
    );
    
    if (!userResponse.ok) {
      throw new Error('Sleeper user fetch failed');
    }
    
    const user = await userResponse.json();
    
    // Get user's leagues
    const leaguesResponse = await fetch(
      `${PLATFORM_APIS.sleeper}/user/${user.user_id}/leagues/nfl/2024`
    );
    
    if (!leaguesResponse.ok) {
      throw new Error('Sleeper leagues fetch failed');
    }
    
    const leagues = await leaguesResponse.json();
    
    return leagues.map((league: any) => ({
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
    console.error('Sleeper leagues fetch error:', error);
    throw error;
  }
}

async function fetchCBSLeagues(token: string) {
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

async function fetchDraftKingsContests(token: string) {
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

async function fetchFanDuelContests(token: string) {
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