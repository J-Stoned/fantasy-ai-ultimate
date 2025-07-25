export interface League {
  id: string;
  platformId: string;
  platform: 'yahoo' | 'espn' | 'sleeper' | 'cbs' | 'fantrax';
  userId: string;
  name: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  season: string;
  teamCount: number;
  scoringType: string;
  isActive: boolean;
  myTeamId?: string;
  myTeamName?: string;
  currentStanding?: number;
  settings: LeagueSettings;
  lastSynced: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueSettings {
  scoringSystem: ScoringSystem;
  rosterPositions: RosterPosition[];
  playoffWeeks: number[];
  tradeDeadline?: Date;
  waiverType: 'faab' | 'priority' | 'none';
  faabBudget?: number;
  keeperSettings?: KeeperSettings;
}

export interface ScoringSystem {
  passingYards: number;
  passingTDs: number;
  interceptions: number;
  rushingYards: number;
  rushingTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  [key: string]: number;
}

export interface RosterPosition {
  position: string;
  count: number;
  flex?: boolean;
}

export interface KeeperSettings {
  keeperCount: number;
  keeperRules: 'round_penalty' | 'auction_inflation' | 'no_penalty';
  keeperDeadline: Date;
}

export interface Team {
  id: string;
  leagueId: string;
  managerId: string;
  name: string;
  logo?: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  pointsFor: number;
  pointsAgainst: number;
  standing: number;
  playoffSeed?: number;
  roster: RosterSlot[];
}

export interface RosterSlot {
  position: string;
  playerId?: string;
  status: 'active' | 'bench' | 'ir' | 'taxi';
}