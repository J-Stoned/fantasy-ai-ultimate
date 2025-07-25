export interface Contest {
  id: string;
  platform: 'draftkings' | 'fanduel' | 'yahoo' | 'superdraft';
  platformId: string;
  name: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  contestType: ContestType;
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  totalEntries: number;
  currentEntries: number;
  salaryCap: number;
  startTime: Date;
  endTime?: Date;
  games: string[];
  payoutStructure: PayoutTier[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ContestType = 
  | 'tournament'
  | 'cash'
  | 'h2h'
  | 'league'
  | 'satellite'
  | 'qualifier';

export interface PayoutTier {
  minRank: number;
  maxRank: number;
  prize: number;
}

export interface ContestEntry {
  id: string;
  contestId: string;
  userId: string;
  lineup: LineupPlayer[];
  totalSalary: number;
  projectedPoints: number;
  actualPoints?: number;
  rank?: number;
  winnings?: number;
  submittedAt: Date;
  updatedAt: Date;
}

export interface LineupPlayer {
  playerId: string;
  position: string;
  salary: number;
  projectedPoints: number;
  actualPoints?: number;
  multiplier?: number; // For captain mode
}

export interface DFSPlayer {
  id: string;
  playerId: string; // Links to main player database
  platform: 'draftkings' | 'fanduel' | 'yahoo' | 'superdraft';
  gameId: string;
  salary: number;
  position: string;
  projectedOwnership: number;
  projectedPoints: number;
  value: number; // points per $1000
  gameInfo: GameInfo;
}

export interface GameInfo {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  vegasTotal: number;
  spread: number;
  pace?: number; // NBA/NHL
  weather?: {
    temperature: number;
    windSpeed: number;
    precipitation: number;
  }; // NFL/MLB
}