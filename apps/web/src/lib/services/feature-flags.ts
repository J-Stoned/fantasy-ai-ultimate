/**
 * Feature Flag Service - Elite Developer Pattern
 * Controls feature availability based on environment
 */

interface FeatureFlags {
  ML_PREDICTIONS: boolean;
  DFS_OPTIMIZER: boolean;
  ADVANCED_ANALYTICS: boolean;
  REAL_TIME_DATA: boolean;
}

class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: FeatureFlags;

  private constructor() {
    this.flags = {
      ML_PREDICTIONS: process.env.ENABLE_ML === 'true',
      DFS_OPTIMIZER: process.env.ENABLE_DFS_OPTIMIZER === 'true',
      ADVANCED_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
      REAL_TIME_DATA: process.env.ENABLE_REALTIME === 'true',
    };
  }

  static getInstance(): FeatureFlagService {
    if (!this.instance) {
      this.instance = new FeatureFlagService();
    }
    return this.instance;
  }

  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature] || false;
  }

  async checkRemoteFlags(): Promise<void> {
    // In production, fetch from a service like LaunchDarkly
    if (process.env.NODE_ENV === 'production') {
      try {
        const response = await fetch('/api/feature-flags');
        const remoteFlags = await response.json();
        this.flags = { ...this.flags, ...remoteFlags };
      } catch (error) {
        }
    }
  }
}

export const featureFlags = FeatureFlagService.getInstance();