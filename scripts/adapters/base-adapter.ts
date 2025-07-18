// Base adapter interface for all sports adapters
export interface Team {
  id: number;
  externalId: string;
  name: string;
  abbreviation: string;
  city: string;
  displayName: string;
  metadata?: any;
}

export interface Player {
  id: number;
  externalId: string;
  name: string;
  firstName: string;
  lastName: string;
  teamId: number;
  position: string;
  jerseyNumber?: string;
  metadata?: any;
}

export interface Game {
  id: number;
  externalId: string;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  status: string;
  season: number;
  metadata?: any;
}

export interface PlayerGameStats {
  playerId: number;
  gameId: number;
  teamId: number;
  stats: any;
  isHome: boolean;
  isPitcher?: boolean;
}

export abstract class BaseAdapter {
  protected sport: string;

  constructor(sport: string) {
    this.sport = sport;
  }

  abstract getTeams(season: number): Promise<Team[]>;
  abstract getPlayers(teamId: number): Promise<Player[]>;
  abstract getGames(startDate: string, endDate: string): Promise<Game[]>;
  abstract getGameStats(gameId: number): Promise<PlayerGameStats[]>;
}