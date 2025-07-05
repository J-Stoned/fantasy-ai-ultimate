/**
 * 👤 USER PREFERENCE MANAGEMENT SYSTEM
 * Personalized settings for predictions and notifications
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserPreferences {
  userId: string;
  displayName?: string;
  email?: string;
  
  // Prediction preferences
  favoriteTeams: string[];
  favoritePlayers: string[];
  sports: string[];
  predictionFilters: {
    minConfidence: number;
    onlyFavorites: boolean;
    excludeTeams: string[];
  };
  
  // Notification preferences
  notifications: {
    predictions: {
      enabled: boolean;
      minConfidence: number;
      favoriteTeamsOnly: boolean;
    };
    arbitrage: {
      enabled: boolean;
      minProfit: number;
    };
    gameStart: {
      enabled: boolean;
      minutesBefore: number;
    };
    outcomes: {
      enabled: boolean;
      onlyPredicted: boolean;
    };
    dailySummary: {
      enabled: boolean;
      time: string; // "09:00"
    };
  };
  
  // Delivery channels
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  
  // Time preferences
  timezone: string;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  
  // Betting preferences
  betting: {
    enabled: boolean;
    defaultStake: number;
    maxDailyLoss: number;
    favoriteBookmakers: string[];
    excludeBookmakers: string[];
  };
  
  // Display preferences
  display: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showOdds: boolean;
    probabilityFormat: 'percentage' | 'decimal' | 'american';
  };
  
  // Privacy
  privacy: {
    shareActivity: boolean;
    publicProfile: boolean;
    showInLeaderboard: boolean;
  };
  
  // Advanced
  advanced: {
    apiAccess: boolean;
    webhookUrl?: string;
    customModels: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export class UserPreferenceManager {
  private cache = new Map<string, UserPreferences>();
  
  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    // Check cache
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }
    
    // Load from database
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // Return defaults
      return this.getDefaultPreferences(userId);
    }
    
    const preferences = this.parsePreferences(data);
    this.cache.set(userId, preferences);
    
    return preferences;
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const updated = this.mergePreferences(current, updates);
    
    // Save to database
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferences: updated,
        updated_at: new Date()
      });
    
    if (!error) {
      this.cache.set(userId, updated);
      console.log(chalk.green(`✅ Preferences updated for user ${userId}`));
    }
    
    return updated;
  }
  
  /**
   * Get preference insights
   */
  async getInsights(userId: string) {
    const prefs = await this.getPreferences(userId);
    
    const insights = {
      totalFavoriteTeams: prefs.favoriteTeams.length,
      notificationTypes: Object.entries(prefs.notifications)
        .filter(([_, config]) => config.enabled)
        .map(([type]) => type),
      activeChannels: Object.entries(prefs.channels)
        .filter(([_, enabled]) => enabled)
        .map(([channel]) => channel),
      bettingEnabled: prefs.betting.enabled,
      privacyLevel: prefs.privacy.publicProfile ? 'public' : 'private',
      customizations: {
        hasQuietHours: prefs.quietHours.enabled,
        hasCustomStake: prefs.betting.defaultStake !== 100,
        hasExclusions: prefs.predictionFilters.excludeTeams.length > 0
      }
    };
    
    return insights;
  }
  
  /**
   * Get users by preference criteria
   */
  async findUsersByPreferences(criteria: {
    favoriteTeam?: string;
    sport?: string;
    notificationType?: string;
    minConfidence?: number;
  }): Promise<string[]> {
    const { data } = await supabase
      .from('user_preferences')
      .select('user_id, preferences');
    
    if (!data) return [];
    
    return data
      .filter(row => {
        const prefs = this.parsePreferences(row);
        
        if (criteria.favoriteTeam && !prefs.favoriteTeams.includes(criteria.favoriteTeam)) {
          return false;
        }
        
        if (criteria.sport && !prefs.sports.includes(criteria.sport)) {
          return false;
        }
        
        if (criteria.minConfidence && prefs.predictionFilters.minConfidence < criteria.minConfidence) {
          return false;
        }
        
        if (criteria.notificationType && !prefs.notifications[criteria.notificationType as keyof typeof prefs.notifications]?.enabled) {
          return false;
        }
        
        return true;
      })
      .map(row => row.user_id);
  }
  
  /**
   * Bulk update for admin operations
   */
  async bulkUpdate(
    userIds: string[],
    updates: Partial<UserPreferences>
  ): Promise<number> {
    let updated = 0;
    
    for (const userId of userIds) {
      try {
        await this.updatePreferences(userId, updates);
        updated++;
      } catch (error) {
        console.error(chalk.red(`Failed to update ${userId}`));
      }
    }
    
    console.log(chalk.green(`✅ Updated ${updated}/${userIds.length} users`));
    return updated;
  }
  
  /**
   * Export user preferences
   */
  async exportPreferences(userId: string): Promise<string> {
    const prefs = await this.getPreferences(userId);
    return JSON.stringify(prefs, null, 2);
  }
  
  /**
   * Import user preferences
   */
  async importPreferences(userId: string, json: string): Promise<UserPreferences> {
    try {
      const imported = JSON.parse(json);
      return await this.updatePreferences(userId, imported);
    } catch (error) {
      throw new Error('Invalid preference format');
    }
  }
  
  /**
   * Get preference statistics
   */
  async getStats() {
    const { data } = await supabase
      .from('user_preferences')
      .select('preferences');
    
    if (!data) return null;
    
    const stats = {
      totalUsers: data.length,
      favoriteTeams: new Set<string>(),
      notificationStats: {
        predictions: 0,
        arbitrage: 0,
        gameStart: 0,
        outcomes: 0
      },
      channelStats: {
        push: 0,
        email: 0,
        sms: 0,
        inApp: 0
      },
      bettingEnabled: 0,
      themes: {
        light: 0,
        dark: 0,
        auto: 0
      }
    };
    
    data.forEach(row => {
      const prefs = this.parsePreferences(row);
      
      prefs.favoriteTeams.forEach(team => stats.favoriteTeams.add(team));
      
      if (prefs.notifications.predictions.enabled) stats.notificationStats.predictions++;
      if (prefs.notifications.arbitrage.enabled) stats.notificationStats.arbitrage++;
      if (prefs.notifications.gameStart.enabled) stats.notificationStats.gameStart++;
      if (prefs.notifications.outcomes.enabled) stats.notificationStats.outcomes++;
      
      if (prefs.channels.push) stats.channelStats.push++;
      if (prefs.channels.email) stats.channelStats.email++;
      if (prefs.channels.sms) stats.channelStats.sms++;
      if (prefs.channels.inApp) stats.channelStats.inApp++;
      
      if (prefs.betting.enabled) stats.bettingEnabled++;
      
      stats.themes[prefs.display.theme]++;
    });
    
    return {
      ...stats,
      favoriteTeams: Array.from(stats.favoriteTeams).sort()
    };
  }
  
  /**
   * Get default preferences
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      favoriteTeams: [],
      favoritePlayers: [],
      sports: ['NBA'],
      predictionFilters: {
        minConfidence: 0.6,
        onlyFavorites: false,
        excludeTeams: []
      },
      notifications: {
        predictions: {
          enabled: true,
          minConfidence: 0.75,
          favoriteTeamsOnly: false
        },
        arbitrage: {
          enabled: true,
          minProfit: 2
        },
        gameStart: {
          enabled: true,
          minutesBefore: 15
        },
        outcomes: {
          enabled: true,
          onlyPredicted: true
        },
        dailySummary: {
          enabled: false,
          time: '09:00'
        }
      },
      channels: {
        push: true,
        email: false,
        sms: false,
        inApp: true
      },
      timezone: 'America/New_York',
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      },
      betting: {
        enabled: false,
        defaultStake: 100,
        maxDailyLoss: 500,
        favoriteBookmakers: [],
        excludeBookmakers: []
      },
      display: {
        theme: 'auto',
        compactMode: false,
        showOdds: true,
        probabilityFormat: 'percentage'
      },
      privacy: {
        shareActivity: true,
        publicProfile: false,
        showInLeaderboard: true
      },
      advanced: {
        apiAccess: false,
        customModels: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Parse preferences from database
   */
  private parsePreferences(data: any): UserPreferences {
    if (data.preferences) {
      return {
        ...this.getDefaultPreferences(data.user_id),
        ...data.preferences,
        userId: data.user_id
      };
    }
    
    return this.getDefaultPreferences(data.user_id);
  }
  
  /**
   * Merge preference updates
   */
  private mergePreferences(
    current: UserPreferences,
    updates: Partial<UserPreferences>
  ): UserPreferences {
    return {
      ...current,
      ...updates,
      notifications: {
        ...current.notifications,
        ...(updates.notifications || {})
      },
      channels: {
        ...current.channels,
        ...(updates.channels || {})
      },
      predictionFilters: {
        ...current.predictionFilters,
        ...(updates.predictionFilters || {})
      },
      quietHours: {
        ...current.quietHours,
        ...(updates.quietHours || {})
      },
      betting: {
        ...current.betting,
        ...(updates.betting || {})
      },
      display: {
        ...current.display,
        ...(updates.display || {})
      },
      privacy: {
        ...current.privacy,
        ...(updates.privacy || {})
      },
      advanced: {
        ...current.advanced,
        ...(updates.advanced || {})
      },
      updatedAt: new Date()
    };
  }
}