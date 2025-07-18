/**
 * 🎓 NCAA API Adapter - Transforms ESPN NCAA API responses
 * Supports Football, Basketball, Baseball, and Hockey
 */

export default {
  transformGame: (data: any, sportHint?: string) => {
    // Determine sport type
    let sport = 'NCAA_FB';
    
    // Use sport hint if provided
    if (sportHint === 'hockey' || sportHint === 'NCAA_HKY') {
      sport = 'NCAA_HKY';
    } else if (data.sport === 'college-basketball' || data.sport === 'basketball') {
      sport = 'NCAA_BB';
    } else if (data.sport === 'college-baseball' || data.sport === 'baseball') {
      sport = 'NCAA_BASEBALL';
    } else if (data.sport === 'college-hockey' || data.sport === 'hockey') {
      sport = 'NCAA_HKY';
    }
    
    // Handle missing competitions
    const competition = data.competitions?.[0];
    
    // Fallback detection based on game structure
    if (sport === 'NCAA_FB' && competition?.situation?.period !== undefined) {
      // Hockey has periods, not quarters
      sport = 'NCAA_HKY';
    }
    if (!competition || !competition.competitors) {
      return null; // Skip games with no competition data
    }
    
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
    
    if (!homeTeam || !awayTeam) {
      return null; // Skip games without both teams
    }
    
    return {
      external_id: `espn_ncaa_${data.id}`,
      date: data.date,
      home_team_id: homeTeam.team?.id,
      away_team_id: awayTeam.team?.id,
      home_score: parseInt(homeTeam.score) || 0,
      away_score: parseInt(awayTeam.score) || 0,
      status: data.status?.type?.name || 'scheduled',
      sport: sport,
      week: data.week?.number,
      season: data.season?.year,
      metadata: {
        venue: competition.venue?.fullName,
        conference: competition.competitors[0]?.team?.conferenceId,
        attendance: competition.attendance,
        inning: competition.situation?.inning, // For baseball
        outs: competition.situation?.outs, // For baseball
        period: competition.situation?.period, // For hockey
        timeRemaining: competition.situation?.displayClock // For hockey/basketball
      }
    };
  },
  
  transformPlayer: (data: any, sportHint?: string) => {
    // Determine sport type
    let sport = 'NCAA_FB';
    
    // Use sport hint if provided
    if (sportHint === 'hockey' || sportHint === 'NCAA_HKY') {
      sport = 'NCAA_HKY';
    } else if (data.sport === 'college-basketball' || data.sport === 'basketball') {
      sport = 'NCAA_BB';
    } else if (data.sport === 'college-baseball' || data.sport === 'baseball') {
      sport = 'NCAA_BASEBALL';
    } else if (data.sport === 'college-hockey' || data.sport === 'hockey') {
      sport = 'NCAA_HKY';
    }
    
    return {
      external_id: `espn_ncaa_${data.id}`,
      name: data.displayName || data.fullName,
      position: data.position?.abbreviation,
      team_id: data.team?.id,
      sport: sport,
      metadata: {
        jersey: data.jersey,
        height: data.height,
        weight: data.weight,
        age: data.age,
        class: data.class,
        hometown: data.hometown,
        bats: data.bats, // For baseball
        throws: data.throws // For baseball
      }
    };
  },
  
  transformTeam: (data: any, sportHint?: string) => {
    // Determine sport type
    let sport = 'NCAA_FB';
    
    // Use sport hint if provided
    if (sportHint === 'hockey' || sportHint === 'NCAA_HKY') {
      sport = 'NCAA_HKY';
    } else if (data.sport === 'college-basketball' || data.sport === 'basketball') {
      sport = 'NCAA_BB';
    } else if (data.sport === 'college-baseball' || data.sport === 'baseball') {
      sport = 'NCAA_BASEBALL';
    } else if (data.sport === 'college-hockey' || data.sport === 'hockey') {
      sport = 'NCAA_HKY';
    }
    
    return {
      external_id: `espn_ncaa_${data.id}`,
      name: data.displayName,
      abbreviation: data.abbreviation,
      sport: sport,
      metadata: {
        location: data.location,
        color: data.color,
        logo: data.logos?.[0]?.href,
        conference: data.conferenceId,
        mascot: data.mascot
      }
    };
  },
  
  transformStats: (data: any) => {
    if (!data.statistics) return [];
    
    return data.statistics.map((stat: any) => ({
      external_id: `espn_ncaa_stat_${data.playerId}_${data.gameId}_${stat.name}`,
      player_id: data.playerId,
      game_id: data.gameId,
      stat_type: stat.name,
      value: stat.value,
      sport: data.sport === 'college-football' ? 'NCAA_FB' : 'NCAA_BB'
    }));
  }
};