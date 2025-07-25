// External Fantasy Platform API Response Types

// Yahoo Fantasy API Types
export interface YahooApiResponse {
  fantasy_content?: {
    users?: Array<{
      user?: [
        unknown,
        {
          games?: Record<string, YahooGame>;
        }
      ];
    }>;
  };
}

export interface YahooGame {
  game_key: string;
  leagues?: Record<string, YahooLeagueWrapper>;
}

export interface YahooLeagueWrapper {
  league?: [
    YahooLeague,
    {
      teams?: Array<{
        team?: [
          YahooTeam,
          {
            team_standings?: {
              rank: number;
            };
          }
        ];
      }>;
    }?
  ];
}

export interface YahooLeague {
  league_key: string;
  name: string;
  season: string;
  num_teams: number;
  scoring_type: string;
  is_finished: '0' | '1';
}

export interface YahooTeam {
  team_key: string;
  name: string;
}

// ESPN Fantasy API Types
export interface ESPNApiResponse {
  id: number;
  seasonId: number;
  settings: ESPNLeagueSettings;
  teams?: ESPNTeamData[];
  members?: ESPNMember[];
  status: ESPNLeagueStatus;
  schedule?: ESPNMatchup[];
  draftDetail?: ESPNDraftDetail;
  topics?: ESPNTopic[];
  players?: ESPNPlayerData[];
}

export interface ESPNLeagueSettings {
  name: string;
  size: number;
  scoringType: string;
  scoringSettings?: {
    scoringItems?: ESPNScoringItem[];
  };
  rosterSettings?: {
    lineupSlotCounts?: Record<string, number>;
  };
  acquisitionSettings?: {
    acquisitionType?: string;
    isUsingAcquisitionBudget?: boolean;
  };
  tradeSettings?: {
    deadlineDate?: number;
  };
  draftSettings?: {
    type?: string;
  };
  scheduleSettings?: {
    matchupPeriodCount?: number;
    playoffMatchupPeriodCount?: number;
  };
}

export interface ESPNScoringItem {
  statId: number;
  points?: number;
  pointsOverrides?: Array<{
    points: number;
  }>;
}

export interface ESPNLeagueStatus {
  isActive: boolean;
  currentMatchupPeriod: number;
}

export interface ESPNTeamData {
  id: number;
  location: string;
  nickname: string;
  abbrev: string;
  logo?: string;
  primaryOwner?: string;
  record?: {
    overall?: ESPNTeamRecord;
  };
  draftDayProjectedRank?: number;
  currentProjectedRank?: number;
  playoffSeed?: number;
  rankCalculatedFinal?: number;
  roster?: {
    entries?: ESPNRosterEntry[];
  };
}

export interface ESPNTeamRecord {
  wins: number;
  losses: number;
  ties: number;
  pointsFor?: number;
  pointsAgainst?: number;
  streakType?: string;
  streakLength?: number;
}

export interface ESPNMember {
  id: string;
  displayName: string;
}

export interface ESPNRosterEntry {
  playerId: number;
  lineupSlotId: number;
  playerPoolEntry?: {
    appliedStatTotal?: number;
    appliedStats?: Record<string, number>;
  };
  acquisitionType?: string;
  acquisitionDate?: number;
}

export interface ESPNPlayerData {
  id: number;
  player?: {
    fullName?: string;
    defaultPositionId?: number;
    eligibleSlots?: number[];
    proTeamId?: number;
    injuryStatus?: string;
  };
}

export interface ESPNMatchup {
  matchupPeriodId: number;
  home?: ESPNMatchupTeam;
  away?: ESPNMatchupTeam;
  winner?: string;
  playoffTierType?: string;
}

export interface ESPNMatchupTeam {
  teamId: number;
  totalPoints?: number;
  totalProjectedPoints?: number;
  totalPointsLive?: number;
}

export interface ESPNDraftDetail {
  type?: string;
  startTime?: number;
  completeDate?: number;
  rounds?: number;
  picks?: ESPNDraftPick[];
}

export interface ESPNDraftPick {
  roundId: number;
  roundPickNumber: number;
  overallPickNumber: number;
  teamId: number;
  playerId: number;
  bidAmount?: number;
  keeper?: boolean;
  keeperRoundId?: number;
  timestamp?: number;
}

export interface ESPNTopic {
  id: string;
  type: string;
  messages?: ESPNMessage[];
}

export interface ESPNMessage {
  id: string;
  messageTypeId: number;
  date: number;
  to?: number;
  from?: number;
  for?: number[];
  for2?: number[];
}

export interface ESPNLeague {
  id: string;
  settings: {
    name: string;
    size: number;
    scoringType: string;
  };
  teams?: ESPNTeam[];
}

export interface ESPNTeam {
  id: string;
  owners?: string[];
}

// ESPN Position Info
export interface ESPNPositionInfo {
  name: string;
  abbrev: string;
  isActive: boolean;
  isFlex: boolean;
  eligible: string[];
}

// Sleeper API Types
export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  sport: string;
  season: string;
  total_rosters: number;
  roster_id?: number;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  scoring_settings?: {
    type?: string;
  };
}

// CBS Sports API Types
export interface CBSLeague {
  id: string;
  name: string;
  sport: string;
  season: string;
  teams: CBSTeam[];
  settings: {
    rosterSize: number;
    scoringType: string;
  };
}

export interface CBSTeam {
  id: string;
  name: string;
  owner: string;
  standing: number;
}

// DraftKings API Types
export interface DraftKingsContest {
  contestId: string;
  contestName: string;
  sport: string;
  startTime: string;
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  currentEntries: number;
  contestType: 'gpp' | 'cash' | 'satellite';
  salaryCap: number;
}

export interface DraftKingsPlayer {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projectedPoints: number;
  ownership?: number;
}

// FanDuel API Types
export interface FanDuelContest {
  id: string;
  name: string;
  sport: string;
  startDate: string;
  entryFee: number;
  prizePool: number;
  size: number;
  entries: number;
  type: 'tournament' | 'cash_game' | 'multiplier';
  salaryCap: number;
}

export interface FanDuelPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  fppg: number; // Fantasy Points Per Game
  played: number;
  injury?: {
    status: string;
    details: string;
  };
}

// Generic Response Types
export interface PlatformAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface PlatformErrorResponse {
  error: string;
  error_description?: string;
  error_code?: string;
}