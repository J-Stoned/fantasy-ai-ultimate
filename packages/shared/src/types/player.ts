import { AvatarTier } from './avatar';

export interface Player {
  id: string;
  externalId?: string;
  name: string;
  team: string;
  position: string;
  sport: SportType;
  jerseyNumber?: string;
  height?: string;
  weight?: string;
  birthDate?: Date;
  college?: string;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  status: PlayerStatus;
  injuryStatus?: string;
  injuryDetails?: string;
  rating: number; // 0-100 overall rating
  avatarTier: AvatarTier;
  metadata?: Record<string, unknown>;
}

export type SportType = 'NFL' | 'NBA' | 'MLB' | 'NHL';

export type PlayerStatus = 'active' | 'injured' | 'suspended' | 'retired';

export interface PlayerStats {
  playerId: string;
  season: number;
  week?: number;
  gameId?: string;
  stats: Record<string, number>;
  fantasyPoints: {
    draftKings: number;
    fanduel: number;
    yahoo: number;
    espn: number;
  };
}

export interface PlayerProjection {
  playerId: string;
  gameId?: string;
  week?: number;
  season: number;
  projectionType: 'game' | 'week' | 'season';
  projectedStats: Record<string, number>;
  projectedPoints: {
    draftKings: number;
    fanduel: number;
    yahoo: number;
    espn: number;
  };
  confidence: number; // ML model confidence
  ceiling: number;
  floor: number;
}

export interface PlayerValue {
  playerId: string;
  season: number;
  week: number;
  dfsValue: number; // $/point for DFS
  seasonLongValue: number; // draft position value
  dynastyValue: number; // keeper league value
  tradeValue: number; // in-season trade value
  trending: 'up' | 'down' | 'stable';
}

export interface PlayerNews {
  id: string;
  playerId: string;
  headline: string;
  content: string;
  source: string;
  publishedAt: Date;
  impact: 'positive' | 'negative' | 'neutral';
  fantasyRelevance: 'high' | 'medium' | 'low';
}