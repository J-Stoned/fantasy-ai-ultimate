import axios from 'axios';
import { BaseAdapter, Team, Player, Game, PlayerGameStats } from './base-adapter';

export class MiLBAdapter extends BaseAdapter {
  private readonly API_BASE = 'https://statsapi.mlb.com/api/v1';
  
  // MiLB Sport IDs
  private readonly SPORT_IDS = {
    'MILB_AAA': 11,    // Triple-A
    'MILB_AA': 12,     // Double-A
    'MILB_A+': 13,     // High-A
    'MILB_A': 14,      // Single-A
    'MILB_ROOKIE': 16  // Rookie
  };

  constructor(sport: string) {
    super(sport);
  }

  async getTeams(season: number): Promise<Team[]> {
    const sportId = this.SPORT_IDS[this.sport as keyof typeof this.SPORT_IDS];
    if (!sportId) {
      throw new Error(`Invalid MiLB sport: ${this.sport}`);
    }

    try {
      const response = await axios.get(`${this.API_BASE}/teams`, {
        params: {
          sportId,
          season
        }
      });

      return response.data.teams.map((team: any) => ({
        id: team.id,
        externalId: `mlb_milb_${team.id}`,
        name: team.name,
        abbreviation: team.abbreviation,
        city: team.locationName,
        displayName: team.name,
        metadata: {
          parentOrgId: team.parentOrgId,
          parentOrgName: team.parentOrgName,
          league: team.league?.name,
          division: team.division?.name,
          venue: team.venue?.name,
          firstYearOfPlay: team.firstYearOfPlay
        }
      }));
    } catch (error) {
      console.error(`Error fetching MiLB teams:`, error);
      throw error;
    }
  }

  async getPlayers(teamId: number): Promise<Player[]> {
    try {
      const response = await axios.get(`${this.API_BASE}/teams/${teamId}/roster`, {
        params: {
          rosterType: 'active'
        }
      });

      return response.data.roster.map((player: any) => ({
        id: player.person.id,
        externalId: `mlb_milb_${player.person.id}`,
        name: player.person.fullName,
        firstName: player.person.firstName,
        lastName: player.person.lastName,
        teamId: teamId,
        position: player.position.abbreviation,
        jerseyNumber: player.jerseyNumber,
        metadata: {
          birthDate: player.person.birthDate,
          height: player.person.height,
          weight: player.person.weight,
          birthCity: player.person.birthCity,
          birthCountry: player.person.birthCountry,
          status: player.status?.description
        }
      }));
    } catch (error) {
      console.error(`Error fetching players for team ${teamId}:`, error);
      return [];
    }
  }

  async getGames(startDate: string, endDate: string): Promise<Game[]> {
    const sportId = this.SPORT_IDS[this.sport as keyof typeof this.SPORT_IDS];
    
    try {
      const response = await axios.get(`${this.API_BASE}/schedule`, {
        params: {
          sportId,
          startDate,
          endDate
        }
      });

      const games: Game[] = [];
      
      for (const date of response.data.dates || []) {
        for (const game of date.games || []) {
          // Only include completed games
          if (game.status.statusCode === 'F') {
            games.push({
              id: game.gamePk,
              externalId: `mlb_milb_${game.gamePk}`,
              date: game.gameDate,
              homeTeamId: game.teams.home.team.id,
              awayTeamId: game.teams.away.team.id,
              homeScore: game.teams.home.score || 0,
              awayScore: game.teams.away.score || 0,
              status: game.status.detailedState,
              season: parseInt(game.season),
              metadata: {
                venue: game.venue?.name,
                gameType: game.gameType,
                scheduledInnings: game.scheduledInnings,
                inningsPitched: game.linescore?.innings?.length
              }
            });
          }
        }
      }
      
      return games;
    } catch (error) {
      console.error(`Error fetching games:`, error);
      throw error;
    }
  }

  async getGameStats(gameId: number): Promise<PlayerGameStats[]> {
    try {
      const response = await axios.get(`${this.API_BASE}/game/${gameId}/boxscore`);
      const stats: PlayerGameStats[] = [];
      const boxscore = response.data;

      // Process both teams
      for (const side of ['away', 'home'] as const) {
        const teamData = boxscore.teams[side];
        const teamId = teamData.team.id;
        
        // Process batters
        for (const playerId in teamData.players || {}) {
          const player = teamData.players[`ID${playerId}`];
          
          if (player.stats.batting && Object.keys(player.stats.batting).length > 0) {
            const battingStats = player.stats.batting;
            
            stats.push({
              playerId: parseInt(playerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                // Batting stats
                atBats: battingStats.atBats || 0,
                runs: battingStats.runs || 0,
                hits: battingStats.hits || 0,
                doubles: battingStats.doubles || 0,
                triples: battingStats.triples || 0,
                homeRuns: battingStats.homeRuns || 0,
                rbi: battingStats.rbi || 0,
                baseOnBalls: battingStats.baseOnBalls || 0,
                strikeOuts: battingStats.strikeOuts || 0,
                stolenBases: battingStats.stolenBases || 0,
                caughtStealing: battingStats.caughtStealing || 0,
                avg: battingStats.avg || '.000',
                obp: battingStats.obp || '.000',
                slg: battingStats.slg || '.000',
                ops: battingStats.ops || '.000'
              },
              isHome: side === 'home'
            });
          }
          
          // Process pitchers
          if (player.stats.pitching && Object.keys(player.stats.pitching).length > 0) {
            const pitchingStats = player.stats.pitching;
            
            stats.push({
              playerId: parseInt(playerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                // Pitching stats
                inningsPitched: pitchingStats.inningsPitched || '0.0',
                hits: pitchingStats.hits || 0,
                runs: pitchingStats.runs || 0,
                earnedRuns: pitchingStats.earnedRuns || 0,
                baseOnBalls: pitchingStats.baseOnBalls || 0,
                strikeOuts: pitchingStats.strikeOuts || 0,
                homeRuns: pitchingStats.homeRuns || 0,
                era: pitchingStats.era || '0.00',
                whip: pitchingStats.whip || '0.00',
                pitchesThrown: pitchingStats.numberOfPitches || 0,
                strikes: pitchingStats.strikes || 0,
                balls: pitchingStats.balls || 0,
                win: pitchingStats.wins || 0,
                loss: pitchingStats.losses || 0,
                save: pitchingStats.saves || 0,
                blownSave: pitchingStats.blownSaves || 0,
                hold: pitchingStats.holds || 0
              },
              isHome: side === 'home',
              isPitcher: true
            });
          }
        }
      }
      
      return stats;
    } catch (error) {
      console.error(`Error fetching game stats for ${gameId}:`, error);
      return [];
    }
  }

  async getPlayerSeasonStats(playerId: number, season: number): Promise<any> {
    try {
      // Get hitting stats
      const hittingResponse = await axios.get(`${this.API_BASE}/people/${playerId}/stats`, {
        params: {
          stats: 'season',
          season,
          group: 'hitting'
        }
      });

      // Get pitching stats
      const pitchingResponse = await axios.get(`${this.API_BASE}/people/${playerId}/stats`, {
        params: {
          stats: 'season',
          season,
          group: 'pitching'
        }
      });

      return {
        hitting: hittingResponse.data.stats?.[0]?.splits?.[0]?.stat || null,
        pitching: pitchingResponse.data.stats?.[0]?.splits?.[0]?.stat || null
      };
    } catch (error) {
      console.error(`Error fetching season stats for player ${playerId}:`, error);
      return null;
    }
  }

  // Helper method to get all MiLB levels
  static getAllLevels(): string[] {
    return ['MILB_AAA', 'MILB_AA', 'MILB_A+', 'MILB_A', 'MILB_ROOKIE'];
  }
}