/**
 * 🚩 Feature Flags System
 * Enterprise-grade feature toggle management for safe rollouts
 */

import { env } from '../config/environment';

// Feature flag definitions
export const FEATURES = {
  // ML Features
  ML_TRAINING_DASHBOARD: 'ml_training_dashboard',
  ML_AUTO_RETRAIN: 'ml_auto_retrain',
  ML_ADVANCED_MODELS: 'ml_advanced_models',
  
  // DFS Features
  DFS_TRADING_TERMINAL: 'dfs_trading_terminal',
  DFS_MULTI_ENTRY: 'dfs_multi_entry',
  DFS_LATE_SWAP: 'dfs_late_swap',
  DFS_OWNERSHIP_PROJECTIONS: 'dfs_ownership_projections',
  
  // Trading Features
  KELLY_CRITERION: 'kelly_criterion',
  PORTFOLIO_OPTIMIZATION: 'portfolio_optimization',
  RISK_MANAGEMENT: 'risk_management',
  
  // UI Features
  DARK_MODE: 'dark_mode',
  VOICE_ASSISTANT: 'voice_assistant',
  REAL_TIME_UPDATES: 'real_time_updates',
  ADVANCED_CHARTS: 'advanced_charts',
  
  // Admin Features
  ADMIN_DASHBOARD: 'admin_dashboard',
  ADMIN_USER_MANAGEMENT: 'admin_user_management',
  ADMIN_SYSTEM_MONITORING: 'admin_system_monitoring',
  
  // Experimental
  BETA_FEATURES: 'beta_features',
  AI_INSIGHTS: 'ai_insights',
  PATTERN_DETECTION_V2: 'pattern_detection_v2',
} as const;

export type FeatureFlag = typeof FEATURES[keyof typeof FEATURES];

// Feature flag configuration
interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number;
  userWhitelist?: string[];
  userBlacklist?: string[];
  environments?: Array<'development' | 'staging' | 'production'>;
  startDate?: Date;
  endDate?: Date;
}

// Default feature configurations
const defaultFlags: Record<FeatureFlag, FeatureFlagConfig> = {
  // ML Features - Production ready
  [FEATURES.ML_TRAINING_DASHBOARD]: {
    enabled: true,
    environments: ['development', 'staging', 'production'],
  },
  [FEATURES.ML_AUTO_RETRAIN]: {
    enabled: false,
    rolloutPercentage: 10,
    environments: ['staging'],
  },
  [FEATURES.ML_ADVANCED_MODELS]: {
    enabled: true,
    rolloutPercentage: 50,
    environments: ['development', 'staging', 'production'],
  },
  
  // DFS Features - Production ready
  [FEATURES.DFS_TRADING_TERMINAL]: {
    enabled: true,
    environments: ['development', 'staging', 'production'],
  },
  [FEATURES.DFS_MULTI_ENTRY]: {
    enabled: true,
    rolloutPercentage: 100,
  },
  [FEATURES.DFS_LATE_SWAP]: {
    enabled: false,
    rolloutPercentage: 5,
    environments: ['staging'],
  },
  [FEATURES.DFS_OWNERSHIP_PROJECTIONS]: {
    enabled: true,
    rolloutPercentage: 75,
  },
  
  // Trading Features
  [FEATURES.KELLY_CRITERION]: {
    enabled: true,
    environments: ['development', 'staging', 'production'],
  },
  [FEATURES.PORTFOLIO_OPTIMIZATION]: {
    enabled: true,
  },
  [FEATURES.RISK_MANAGEMENT]: {
    enabled: true,
  },
  
  // UI Features
  [FEATURES.DARK_MODE]: {
    enabled: true,
  },
  [FEATURES.VOICE_ASSISTANT]: {
    enabled: false,
    rolloutPercentage: 25,
    environments: ['development', 'staging'],
  },
  [FEATURES.REAL_TIME_UPDATES]: {
    enabled: true,
  },
  [FEATURES.ADVANCED_CHARTS]: {
    enabled: true,
    rolloutPercentage: 90,
  },
  
  // Admin Features
  [FEATURES.ADMIN_DASHBOARD]: {
    enabled: true,
    userWhitelist: ['admin@fantasy-ai.com'],
  },
  [FEATURES.ADMIN_USER_MANAGEMENT]: {
    enabled: true,
    userWhitelist: ['admin@fantasy-ai.com'],
  },
  [FEATURES.ADMIN_SYSTEM_MONITORING]: {
    enabled: true,
    userWhitelist: ['admin@fantasy-ai.com'],
  },
  
  // Experimental
  [FEATURES.BETA_FEATURES]: {
    enabled: false,
    rolloutPercentage: 1,
    environments: ['development'],
  },
  [FEATURES.AI_INSIGHTS]: {
    enabled: false,
    startDate: new Date('2025-02-01'),
  },
  [FEATURES.PATTERN_DETECTION_V2]: {
    enabled: false,
    rolloutPercentage: 0,
  },
};

// Feature flag service
class FeatureFlagService {
  private flags: Map<FeatureFlag, FeatureFlagConfig>;
  private userId?: string;
  
  constructor() {
    this.flags = new Map(Object.entries(defaultFlags) as Array<[FeatureFlag, FeatureFlagConfig]>);
    this.loadRemoteFlags();
  }
  
  /**
   * Load flags from remote configuration (if available)
   */
  private async loadRemoteFlags() {
    try {
      // In production, load from API or feature flag service
      if (env.NODE_ENV === 'production') {
        const response = await fetch('/api/feature-flags');
        if (response.ok) {
          const remoteFlags = await response.json();
          this.mergeFlags(remoteFlags);
        }
      }
    } catch (error) {
      // Fail silently, use defaults
    }
  }
  
  /**
   * Merge remote flags with defaults
   */
  private mergeFlags(remoteFlags: Partial<Record<FeatureFlag, Partial<FeatureFlagConfig>>>) {
    Object.entries(remoteFlags).forEach(([flag, config]) => {
      const currentConfig = this.flags.get(flag as FeatureFlag);
      if (currentConfig) {
        this.flags.set(flag as FeatureFlag, { ...currentConfig, ...config });
      }
    });
  }
  
  /**
   * Set user context for flag evaluation
   */
  setUser(userId: string) {
    this.userId = userId;
  }
  
  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: FeatureFlag): boolean {
    const config = this.flags.get(feature);
    if (!config) return false;
    
    // Check if globally disabled
    if (!config.enabled) return false;
    
    // Check environment
    if (config.environments && !config.environments.includes(env.NODE_ENV as any)) {
      return false;
    }
    
    // Check date range
    const now = new Date();
    if (config.startDate && now < config.startDate) return false;
    if (config.endDate && now > config.endDate) return false;
    
    // Check user whitelist/blacklist
    if (this.userId) {
      if (config.userBlacklist?.includes(this.userId)) return false;
      if (config.userWhitelist && !config.userWhitelist.includes(this.userId)) return false;
    }
    
    // Check rollout percentage
    if (config.rolloutPercentage !== undefined && config.rolloutPercentage < 100) {
      const hash = this.hashUserId(this.userId || 'anonymous');
      const bucket = hash % 100;
      return bucket < config.rolloutPercentage;
    }
    
    return true;
  }
  
  /**
   * Get all enabled features
   */
  getEnabledFeatures(): FeatureFlag[] {
    return Array.from(this.flags.keys()).filter(flag => this.isEnabled(flag));
  }
  
  /**
   * Get feature configuration
   */
  getConfig(feature: FeatureFlag): FeatureFlagConfig | undefined {
    return this.flags.get(feature);
  }
  
  /**
   * Override feature flag (for testing)
   */
  override(feature: FeatureFlag, enabled: boolean) {
    const config = this.flags.get(feature);
    if (config) {
      this.flags.set(feature, { ...config, enabled });
    }
  }
  
  /**
   * Hash user ID for consistent bucketing
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagService();

// React hook for feature flags
import { useEffect, useState } from 'react';

export function useFeatureFlag(feature: FeatureFlag): boolean {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    setEnabled(featureFlags.isEnabled(feature));
  }, [feature]);
  
  return enabled;
}

// HOC for feature-gated components
import React from 'react';

export function withFeatureFlag<P extends object>(
  feature: FeatureFlag,
  fallback?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(Component: React.ComponentType<P>) {
    return function WrappedComponent(props: P) {
      const enabled = useFeatureFlag(feature);
      
      if (!enabled) {
        return fallback ? React.createElement(fallback, props) : null;
      }
      
      return React.createElement(Component, props);
    };
  };
}