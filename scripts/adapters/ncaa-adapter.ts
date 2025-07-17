/**
 * 🎓 NCAA API Adapter - Transforms ESPN NCAA API responses
 */

export default {
  transformGame: (data: any) => ({
    external_id: `espn_ncaa_${data.id}`,
    date: data.date,
    home_team_id: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'home')?.team.id,
    away_team_id: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'away')?.team.id,
    home_score: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
    away_score: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
    status: data.status?.type?.name || 'scheduled',
    sport: data.sport === 'college-football' ? 'NCAA_FB' : 'NCAA_BB',
    week: data.week?.number,
    season: data.season?.year,
    metadata: {
      venue: data.competitions[0]?.venue?.fullName,
      conference: data.competitions[0]?.competitors[0]?.team?.conferenceId,
      attendance: data.competitions[0]?.attendance
    }
  }),
  
  transformPlayer: (data: any) => ({
    external_id: `espn_ncaa_${data.id}`,
    name: data.displayName || data.fullName,
    position: data.position?.abbreviation,
    team_id: data.team?.id,
    sport: data.sport === 'college-football' ? 'NCAA_FB' : 'NCAA_BB',
    metadata: {
      jersey: data.jersey,
      height: data.height,
      weight: data.weight,
      age: data.age,
      class: data.class,
      hometown: data.hometown
    }
  }),
  
  transformTeam: (data: any) => ({
    external_id: `espn_ncaa_${data.id}`,
    name: data.displayName,
    abbreviation: data.abbreviation,
    sport: data.sport === 'college-football' ? 'NCAA_FB' : 'NCAA_BB',
    metadata: {
      location: data.location,
      color: data.color,
      logo: data.logos?.[0]?.href,
      conference: data.conferenceId,
      mascot: data.mascot
    }
  }),
  
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