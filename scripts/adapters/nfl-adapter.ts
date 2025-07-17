/**
 * 🏈 NFL API Adapter - Transforms ESPN NFL API responses
 */

export default {
  transformGame: (data: any) => ({
    external_id: `espn_nfl_${data.id}`,
    date: data.date,
    home_team_id: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'home')?.team.id,
    away_team_id: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'away')?.team.id,
    home_score: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
    away_score: data.competitions[0]?.competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
    status: data.status?.type?.name || 'scheduled',
    sport: 'NFL',
    week: data.week?.number,
    season: data.season?.year,
    metadata: {
      venue: data.competitions[0]?.venue?.fullName,
      weather: data.weather,
      attendance: data.competitions[0]?.attendance
    }
  }),
  
  transformPlayer: (data: any) => ({
    external_id: `espn_nfl_${data.id}`,
    name: data.displayName || data.fullName,
    position: data.position?.abbreviation,
    team_id: data.team?.id,
    sport: 'NFL',
    metadata: {
      jersey: data.jersey,
      height: data.height,
      weight: data.weight,
      age: data.age,
      experience: data.experience?.years
    }
  }),
  
  transformTeam: (data: any) => ({
    external_id: `espn_nfl_${data.id}`,
    name: data.displayName,
    abbreviation: data.abbreviation,
    sport: 'NFL',
    metadata: {
      location: data.location,
      color: data.color,
      logo: data.logos?.[0]?.href,
      conference: data.conferenceId,
      division: data.divisionId
    }
  }),
  
  transformStats: (data: any) => {
    if (!data.statistics) return [];
    
    return data.statistics.map((stat: any) => ({
      external_id: `espn_nfl_stat_${data.playerId}_${data.gameId}_${stat.name}`,
      player_id: data.playerId,
      game_id: data.gameId,
      stat_type: stat.name,
      value: stat.value,
      sport: 'NFL'
    }));
  }
};