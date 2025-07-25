export type AvatarTier = 'star' | 'starter' | 'bench';

export interface AvatarAsset {
  id: string;
  playerId: string;
  tier: AvatarTier;
  type: '3d' | '2d' | 'photo';
  assetUrl: string;
  thumbnailUrl: string;
  animations?: AvatarAnimation[];
  lastUpdated: Date;
}

export interface AvatarAnimation {
  name: string;
  type: 'idle' | 'celebrate' | 'stats' | 'injury' | 'touchdown' | 'dunk' | 'homerun';
  url: string;
  duration: number;
}

export interface PlayerAvatarProfile {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  tier: AvatarTier;
  rating: number; // 0-100 rating determines tier
  avatarAsset: AvatarAsset;
  customizations?: AvatarCustomization;
}

export interface AvatarCustomization {
  jerseyColor?: string;
  jerseyNumber?: string;
  accessories?: string[];
  celebration?: string;
}

export interface SubscriptionTier {
  id: string;
  name: 'free' | 'basic' | 'pro' | 'elite';
  price: number;
  features: SubscriptionFeatures;
}

export interface SubscriptionFeatures {
  hasAvatars: boolean;
  avatarQuality: 'none' | 'standard' | 'enhanced' | 'ultra';
  customAvatars: boolean;
  arMode: boolean;
  voiceCommands: boolean;
  advancedAnalytics: boolean;
  unlimitedLeagues: boolean;
  premiumSupport: boolean;
}

export const TIER_THRESHOLDS = {
  star: 90,      // Top 500 players (90+ rating)
  starter: 75,   // Next 5,000 players (75-89 rating)  
  bench: 0       // Everyone else (0-74 rating)
} as const;

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  free: {
    id: 'free',
    name: 'free',
    price: 0,
    features: {
      hasAvatars: false,
      avatarQuality: 'none',
      customAvatars: false,
      arMode: false,
      voiceCommands: false,
      advancedAnalytics: false,
      unlimitedLeagues: false,
      premiumSupport: false
    }
  },
  basic: {
    id: 'basic',
    name: 'basic',
    price: 9.99,
    features: {
      hasAvatars: true,
      avatarQuality: 'standard',
      customAvatars: false,
      arMode: false,
      voiceCommands: true,
      advancedAnalytics: false,
      unlimitedLeagues: true,
      premiumSupport: false
    }
  },
  pro: {
    id: 'pro',
    name: 'pro',
    price: 24.99,
    features: {
      hasAvatars: true,
      avatarQuality: 'enhanced',
      customAvatars: true,
      arMode: true,
      voiceCommands: true,
      advancedAnalytics: true,
      unlimitedLeagues: true,
      premiumSupport: false
    }
  },
  elite: {
    id: 'elite',
    name: 'elite',
    price: 49.99,
    features: {
      hasAvatars: true,
      avatarQuality: 'ultra',
      customAvatars: true,
      arMode: true,
      voiceCommands: true,
      advancedAnalytics: true,
      unlimitedLeagues: true,
      premiumSupport: true
    }
  }
};