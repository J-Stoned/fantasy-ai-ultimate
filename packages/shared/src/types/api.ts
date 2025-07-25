export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalCount?: number;
  timestamp?: Date;
  version?: string;
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  subscription: SubscriptionInfo;
  preferences: UserPreferences;
  stats: UserStats;
}

export interface SubscriptionInfo {
  tier: 'free' | 'basic' | 'pro' | 'elite';
  status: 'active' | 'canceled' | 'expired';
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
}

export interface UserPreferences {
  favoriteTeams: string[];
  favoritePlayers: string[];
  notificationSettings: {
    email: boolean;
    push: boolean;
    sms: boolean;
    lineupAlerts: boolean;
    tradeAlerts: boolean;
    injuryAlerts: boolean;
    priceAlerts: boolean;
  };
  displaySettings: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showProjections: boolean;
    defaultScoring: string;
  };
}

export interface UserStats {
  totalLeagues: number;
  totalWins: number;
  winRate: number;
  totalContests: number;
  contestROI: number;
  memberSince: Date;
}