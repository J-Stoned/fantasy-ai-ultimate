import axios from 'axios';
import { BaseAdapter, Team, Player, Game, PlayerGameStats } from './base-adapter';

export class MiLBAdapterEnhanced extends BaseAdapter {
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

      if (!response.data.roster || !Array.isArray(response.data.roster)) {
        return [];
      }
      
      return response.data.roster.map((player: any) => ({
        id: player.person.id,
        externalId: `mlb_milb_${player.person.id}`,
        name: player.person.fullName,
        firstName: player.person.firstName,
        lastName: player.person.lastName,
        teamId: teamId,
        position: player.position.abbreviation,
        jerseyNumber: player.jerseyNumber || null,
        metadata: {
          birthDate: player.person.birthDate,
          height: player.person.height,
          weight: player.person.weight,
          birthCity: player.person.birthCity,
          birthCountry: player.person.birthCountry,
          status: player.status?.description,
          primaryPosition: player.position?.name,
          batSide: player.person.batSide?.code,
          pitchHand: player.person.pitchHand?.code
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
                inningsPitched: game.linescore?.innings?.length,
                dayNight: game.dayNight,
                weather: game.weather,
                wind: game.wind,
                attendance: game.attendance
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
        
        // Process all players
        for (const playerId in teamData.players || {}) {
          const player = teamData.players[playerId];
          
          if (!player || !player.stats) {
            continue;
          }
          
          // Extract numeric ID from playerId
          const numericPlayerId = playerId.replace(/^\D+/, '');
          
          // ENHANCED: Collect ALL batting stats
          if (player.stats.batting && Object.keys(player.stats.batting).length > 0) {
            const battingStats = player.stats.batting;
            
            stats.push({
              playerId: parseInt(numericPlayerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                // Basic stats
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
                
                // Advanced stats
                plateAppearances: battingStats.plateAppearances || 0,
                totalBases: battingStats.totalBases || 0,
                groundIntoDoublePlay: battingStats.groundIntoDoublePlay || 0,
                groundIntoTriplePlay: battingStats.groundIntoTriplePlay || 0,
                hitByPitch: battingStats.hitByPitch || 0,
                intentionalWalks: battingStats.intentionalWalks || 0,
                leftOnBase: battingStats.leftOnBase || 0,
                pickoffs: battingStats.pickoffs || 0,
                sacBunts: battingStats.sacBunts || 0,
                sacFlies: battingStats.sacFlies || 0,
                catchersInterference: battingStats.catchersInterference || 0,
                
                // Outs breakdown
                groundOuts: battingStats.groundOuts || 0,
                airOuts: battingStats.airOuts || 0,
                flyOuts: battingStats.flyOuts || 0,
                lineOuts: battingStats.lineOuts || 0,
                popOuts: battingStats.popOuts || 0,
                
                // Calculated stats
                avg: battingStats.avg || '.000',
                obp: battingStats.obp || '.000',
                slg: battingStats.slg || '.000',
                ops: battingStats.ops || '.000',
                atBatsPerHomeRun: battingStats.atBatsPerHomeRun || '0.0',
                stolenBasePercentage: battingStats.stolenBasePercentage || '.000',
                
                // Metadata
                gamesPlayed: battingStats.gamesPlayed || 1,
                summary: battingStats.summary || '',
                statType: 'batting'
              },
              isHome: side === 'home'
            });
          }
          
          // ENHANCED: Collect ALL pitching stats
          if (player.stats.pitching && Object.keys(player.stats.pitching).length > 0) {
            const pitchingStats = player.stats.pitching;
            
            stats.push({
              playerId: parseInt(numericPlayerId),
              gameId: gameId,
              teamId: teamId,
              stats: {
                // Basic stats
                inningsPitched: pitchingStats.inningsPitched || '0.0',
                hits: pitchingStats.hits || 0,
                runs: pitchingStats.runs || 0,
                earnedRuns: pitchingStats.earnedRuns || 0,
                baseOnBalls: pitchingStats.baseOnBalls || 0,
                strikeOuts: pitchingStats.strikeOuts || 0,
                homeRuns: pitchingStats.homeRuns || 0,
                
                // Advanced stats
                atBats: pitchingStats.atBats || 0,
                battersFaced: pitchingStats.battersFaced || 0,
                outs: pitchingStats.outs || 0,
                doubles: pitchingStats.doubles || 0,
                triples: pitchingStats.triples || 0,
                intentionalWalks: pitchingStats.intentionalWalks || 0,
                hitBatsmen: pitchingStats.hitBatsmen || 0,
                wildPitches: pitchingStats.wildPitches || 0,
                balks: pitchingStats.balks || 0,
                pickoffs: pitchingStats.pickoffs || 0,
                
                // Inherited runners
                inheritedRunners: pitchingStats.inheritedRunners || 0,
                inheritedRunnersScored: pitchingStats.inheritedRunnersScored || 0,
                
                // Outs breakdown
                groundOuts: pitchingStats.groundOuts || 0,
                airOuts: pitchingStats.airOuts || 0,
                flyOuts: pitchingStats.flyOuts || 0,
                lineOuts: pitchingStats.lineOuts || 0,
                popOuts: pitchingStats.popOuts || 0,
                
                // Sacrifice hits
                sacBunts: pitchingStats.sacBunts || 0,
                sacFlies: pitchingStats.sacFlies || 0,
                
                // Stolen bases against
                stolenBases: pitchingStats.stolenBases || 0,
                caughtStealing: pitchingStats.caughtStealing || 0,
                stolenBasePercentage: pitchingStats.stolenBasePercentage || '.000',
                
                // Pitches
                numberOfPitches: pitchingStats.numberOfPitches || 0,
                pitchesThrown: pitchingStats.pitchesThrown || 0,
                strikes: pitchingStats.strikes || 0,
                balls: pitchingStats.balls || 0,
                strikePercentage: pitchingStats.strikePercentage || '.000',
                
                // Game stats
                wins: pitchingStats.wins || 0,
                losses: pitchingStats.losses || 0,
                saves: pitchingStats.saves || 0,
                saveOpportunities: pitchingStats.saveOpportunities || 0,
                holds: pitchingStats.holds || 0,
                blownSaves: pitchingStats.blownSaves || 0,
                gamesPlayed: pitchingStats.gamesPlayed || 1,
                gamesStarted: pitchingStats.gamesStarted || 0,
                gamesFinished: pitchingStats.gamesFinished || 0,
                completeGames: pitchingStats.completeGames || 0,
                shutouts: pitchingStats.shutouts || 0,
                
                // Calculated stats
                era: pitchingStats.era || '0.00',
                whip: pitchingStats.whip || '0.00',
                homeRunsPer9: pitchingStats.homeRunsPer9 || '0.0',
                runsScoredPer9: pitchingStats.runsScoredPer9 || '0.0',
                
                // Other
                passedBall: pitchingStats.passedBall || 0,
                catchersInterference: pitchingStats.catchersInterference || 0,
                rbi: pitchingStats.rbi || 0,
                hitByPitch: pitchingStats.hitByPitch || 0,
                summary: pitchingStats.summary || '',
                statType: 'pitching'
              },
              isHome: side === 'home',
              isPitcher: true
            });
          }
          
          // ENHANCED: Also collect fielding stats if available
          if (player.stats.fielding && Object.keys(player.stats.fielding).length > 0) {
            for (const position in player.stats.fielding) {
              const fieldingStats = player.stats.fielding[position];
              
              if (fieldingStats && Object.keys(fieldingStats).length > 0) {
                stats.push({
                  playerId: parseInt(numericPlayerId),
                  gameId: gameId,
                  teamId: teamId,
                  stats: {
                    position: position,
                    gamesPlayed: fieldingStats.gamesPlayed || 1,
                    gamesStarted: fieldingStats.gamesStarted || 0,
                    innings: fieldingStats.innings || '0.0',
                    chances: fieldingStats.chances || 0,
                    putOuts: fieldingStats.putOuts || 0,
                    assists: fieldingStats.assists || 0,
                    errors: fieldingStats.errors || 0,
                    doublePlays: fieldingStats.doublePlays || 0,
                    triplePlays: fieldingStats.triplePlays || 0,
                    passedBall: fieldingStats.passedBall || 0,
                    wildPitch: fieldingStats.wildPitch || 0,
                    stolenBases: fieldingStats.stolenBases || 0,
                    caughtStealing: fieldingStats.caughtStealing || 0,
                    pickoffs: fieldingStats.pickoffs || 0,
                    fielding: fieldingStats.fielding || '.000',
                    statType: 'fielding'
                  },
                  isHome: side === 'home',
                  isFielding: true
                });
              }
            }
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

      // Get fielding stats
      const fieldingResponse = await axios.get(`${this.API_BASE}/people/${playerId}/stats`, {
        params: {
          stats: 'season',
          season,
          group: 'fielding'
        }
      });

      return {
        hitting: hittingResponse.data.stats?.[0]?.splits?.[0]?.stat || null,
        pitching: pitchingResponse.data.stats?.[0]?.splits?.[0]?.stat || null,
        fielding: fieldingResponse.data.stats?.[0]?.splits?.[0]?.stat || null
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