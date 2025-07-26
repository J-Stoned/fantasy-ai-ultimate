/**
 * 🔥 useAnalytics Hook - Elite Analytics Tracking
 * 
 * React hook for Google Analytics 4 integration with:
 * - Auto-initialization
 * - Event tracking helpers
 * - E-commerce tracking
 * - Performance monitoring
 * - User property management
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@supabase/auth-helpers-react';
import { 
  ga4Service, 
  GA4EventType, 
  GA4EventParams,
  GA4Item,
  CustomDimensions 
} from '../lib/analytics/ga4-service';
import { logger } from '../lib/logging/logger';

// Analytics context for common parameters
interface AnalyticsContext {
  sport?: 'nfl' | 'nba' | 'mlb' | 'nhl';
  platform?: 'draftkings' | 'fanduel' | 'yahoo';
  contestType?: 'gpp' | 'cash' | 'h2h';
  feature?: string;
}

// Hook return interface
interface UseAnalyticsReturn {
  // Core tracking
  trackEvent: (eventName: string, params?: GA4EventParams) => void;
  trackPageView: (pagePath?: string) => void;
  
  // DFS tracking
  trackLineupCreated: (params: {
    sport: string;
    platform: string;
    contestType: string;
    lineupCount?: number;
    totalSalaryUsed?: number;
    optimizationUsed?: boolean;
    mlPredictionsUsed?: boolean;
  }) => void;
  
  trackContestEntered: (params: {
    contestId: string;
    contestName: string;
    entryFee: number;
    maxPrize: number;
    totalEntries: number;
  }) => void;
  
  // ML/AI tracking
  trackPrediction: (params: {
    modelType: string;
    sport: string;
    predictionType: string;
    confidence: number;
    playerCount?: number;
  }) => void;
  
  trackAIInteraction: (params: {
    interactionType: 'chat' | 'voice' | 'suggestion';
    query: string;
    responseTime: number;
    helpful?: boolean;
  }) => void;
  
  // Trading tracking
  trackTradeAnalysis: (params: {
    tradeId: string;
    playersOffered: number;
    playersReceived: number;
    tradeScore: number;
    accepted?: boolean;
  }) => void;
  
  trackWaiverClaim: (params: {
    playerId: string;
    playerName: string;
    success: boolean;
    faabSpent?: number;
  }) => void;
  
  // E-commerce tracking
  trackPurchase: (params: {
    transactionId: string;
    value: number;
    items: GA4Item[];
    tax?: number;
    coupon?: string;
  }) => void;
  
  trackSubscription: (
    action: 'start' | 'cancel' | 'upgrade' | 'downgrade',
    plan: string,
    price: number
  ) => void;
  
  // Feature tracking
  trackFeatureUsage: (featureName: string, value?: any) => void;
  trackToolOpened: (toolName: string) => void;
  
  // Performance tracking
  trackTiming: (name: string, value: number, category?: string) => void;
  trackError: (error: Error, fatal?: boolean) => void;
  
  // User properties
  setUserTier: (tier: 'free' | 'pro' | 'elite') => void;
  setSportPreference: (sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'multi') => void;
  setExperienceLevel: (level: 'beginner' | 'intermediate' | 'expert') => void;
  
  // Context
  setContext: (context: AnalyticsContext) => void;
}

/**
 * Elite analytics tracking hook
 */
export function useAnalytics(): UseAnalyticsReturn {
  const router = useRouter();
  const user = useUser();
  
  // Analytics context
  let context: AnalyticsContext = {};

  /**
   * Initialize analytics
   */
  useEffect(() => {
    ga4Service.initialize();
    
    // Track route changes
    const handleRouteChange = (url: string) => {
      ga4Service.trackPageView({ page_path: url });
    };

    // Listen to route changes
    window.addEventListener('popstate', () => handleRouteChange(window.location.pathname));
    
    return () => {
      window.removeEventListener('popstate', () => handleRouteChange(window.location.pathname));
    };
  }, []);

  /**
   * Update user when auth changes
   */
  useEffect(() => {
    if (user) {
      ga4Service.setUserProperties({
        user_id: user.id,
        signup_date: user.created_at
      });
    } else {
      ga4Service.resetUser();
    }
  }, [user]);

  /**
   * Set analytics context
   */
  const setContext = useCallback((newContext: AnalyticsContext) => {
    context = { ...context, ...newContext };
  }, []);

  /**
   * Track generic event
   */
  const trackEvent = useCallback((eventName: string, params?: GA4EventParams) => {
    const enrichedParams = {
      ...params,
      ...context,
      custom_dimensions: {
        ...params?.custom_dimensions,
        sport_preference: context.sport,
        dfs_platform: context.platform
      }
    };
    
    ga4Service.trackEvent(eventName, enrichedParams);
  }, [context]);

  /**
   * Track page view
   */
  const trackPageView = useCallback((pagePath?: string) => {
    ga4Service.trackPageView({ page_path: pagePath });
  }, []);

  /**
   * Track lineup created
   */
  const trackLineupCreated = useCallback((params: {
    sport: string;
    platform: string;
    contestType: string;
    lineupCount?: number;
    totalSalaryUsed?: number;
    optimizationUsed?: boolean;
    mlPredictionsUsed?: boolean;
  }) => {
    ga4Service.trackLineupCreated({
      sport: params.sport,
      platform: params.platform,
      contest_type: params.contestType,
      lineup_count: params.lineupCount || 1,
      total_salary_used: params.totalSalaryUsed || 0,
      optimization_used: params.optimizationUsed || false,
      ml_predictions_used: params.mlPredictionsUsed || false
    });
  }, []);

  /**
   * Track contest entered
   */
  const trackContestEntered = useCallback((params: {
    contestId: string;
    contestName: string;
    entryFee: number;
    maxPrize: number;
    totalEntries: number;
  }) => {
    trackEvent(GA4EventType.CONTEST_ENTERED, {
      contest_id: params.contestId,
      contest_name: params.contestName,
      value: params.entryFee,
      max_prize: params.maxPrize,
      total_entries: params.totalEntries,
      currency: 'USD'
    });
  }, [trackEvent]);

  /**
   * Track ML prediction
   */
  const trackPrediction = useCallback((params: {
    modelType: string;
    sport: string;
    predictionType: string;
    confidence: number;
    playerCount?: number;
  }) => {
    ga4Service.trackPrediction({
      model_type: params.modelType,
      sport: params.sport,
      prediction_type: params.predictionType,
      confidence: params.confidence,
      ...(params.playerCount && { player_count: params.playerCount })
    });
  }, []);

  /**
   * Track AI interaction
   */
  const trackAIInteraction = useCallback((params: {
    interactionType: 'chat' | 'voice' | 'suggestion';
    query: string;
    responseTime: number;
    helpful?: boolean;
  }) => {
    trackEvent(GA4EventType.AI_CHAT_INTERACTION, {
      interaction_type: params.interactionType,
      query_length: params.query.length,
      response_time_ms: params.responseTime,
      helpful: params.helpful,
      query_category: categorizeQuery(params.query)
    });
  }, [trackEvent]);

  /**
   * Track trade analysis
   */
  const trackTradeAnalysis = useCallback((params: {
    tradeId: string;
    playersOffered: number;
    playersReceived: number;
    tradeScore: number;
    accepted?: boolean;
  }) => {
    trackEvent(GA4EventType.TRADE_ANALYZED, {
      trade_id: params.tradeId,
      players_offered: params.playersOffered,
      players_received: params.playersReceived,
      trade_score: params.tradeScore,
      trade_accepted: params.accepted,
      value: params.tradeScore
    });
  }, [trackEvent]);

  /**
   * Track waiver claim
   */
  const trackWaiverClaim = useCallback((params: {
    playerId: string;
    playerName: string;
    success: boolean;
    faabSpent?: number;
  }) => {
    trackEvent(GA4EventType.WAIVER_CLAIMED, {
      player_id: params.playerId,
      player_name: params.playerName,
      claim_success: params.success,
      faab_spent: params.faabSpent || 0,
      value: params.faabSpent || 0
    });
  }, [trackEvent]);

  /**
   * Track purchase
   */
  const trackPurchase = useCallback((params: {
    transactionId: string;
    value: number;
    items: GA4Item[];
    tax?: number;
    coupon?: string;
  }) => {
    ga4Service.trackPurchase({
      transaction_id: params.transactionId,
      value: params.value,
      currency: 'USD',
      items: params.items,
      tax: params.tax,
      coupon: params.coupon
    });
  }, []);

  /**
   * Track subscription
   */
  const trackSubscription = useCallback((
    action: 'start' | 'cancel' | 'upgrade' | 'downgrade',
    plan: string,
    price: number
  ) => {
    ga4Service.trackSubscription(action, {
      subscription_id: `sub_${Date.now()}`,
      plan_name: plan,
      plan_price: price,
      billing_period: price > 50 ? 'yearly' : 'monthly'
    });
  }, []);

  /**
   * Track feature usage
   */
  const trackFeatureUsage = useCallback((featureName: string, value?: any) => {
    ga4Service.trackFeatureUsage(featureName, {
      feature_category: context.feature || 'general',
      feature_value: value
    });
  }, [context]);

  /**
   * Track tool opened
   */
  const trackToolOpened = useCallback((toolName: string) => {
    trackEvent(GA4EventType.TOOL_OPENED, {
      tool_name: toolName,
      tool_category: categorizeTools(toolName)
    });
  }, [trackEvent]);

  /**
   * Track timing
   */
  const trackTiming = useCallback((name: string, value: number, category?: string) => {
    ga4Service.trackTiming({
      name,
      value,
      category: category || 'performance'
    });
  }, []);

  /**
   * Track error
   */
  const trackError = useCallback((error: Error, fatal?: boolean) => {
    ga4Service.trackException({
      description: error.message,
      fatal,
      error
    });
  }, []);

  /**
   * Set user tier
   */
  const setUserTier = useCallback((tier: 'free' | 'pro' | 'elite') => {
    ga4Service.setUserProperties({ user_tier: tier });
  }, []);

  /**
   * Set sport preference
   */
  const setSportPreference = useCallback((sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'multi') => {
    ga4Service.setUserProperties({ favorite_sport: sport });
  }, []);

  /**
   * Set experience level
   */
  const setExperienceLevel = useCallback((level: 'beginner' | 'intermediate' | 'expert') => {
    const customDimensions: CustomDimensions = { experience_level: level };
    ga4Service.trackEvent('user_level_set', { custom_dimensions: customDimensions });
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackLineupCreated,
    trackContestEntered,
    trackPrediction,
    trackAIInteraction,
    trackTradeAnalysis,
    trackWaiverClaim,
    trackPurchase,
    trackSubscription,
    trackFeatureUsage,
    trackToolOpened,
    trackTiming,
    trackError,
    setUserTier,
    setSportPreference,
    setExperienceLevel,
    setContext
  };
}

/**
 * Categorize AI query
 */
function categorizeQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('lineup') || lowerQuery.includes('optimize')) {
    return 'lineup_optimization';
  } else if (lowerQuery.includes('trade') || lowerQuery.includes('waiver')) {
    return 'roster_management';
  } else if (lowerQuery.includes('injury') || lowerQuery.includes('news')) {
    return 'player_news';
  } else if (lowerQuery.includes('predict') || lowerQuery.includes('projection')) {
    return 'predictions';
  } else if (lowerQuery.includes('start') || lowerQuery.includes('sit')) {
    return 'start_sit';
  } else {
    return 'general';
  }
}

/**
 * Categorize tools
 */
function categorizeTools(toolName: string): string {
  const lowerTool = toolName.toLowerCase();
  
  if (lowerTool.includes('lineup') || lowerTool.includes('optimizer')) {
    return 'dfs_tools';
  } else if (lowerTool.includes('trade') || lowerTool.includes('waiver')) {
    return 'league_tools';
  } else if (lowerTool.includes('predict') || lowerTool.includes('ml')) {
    return 'ai_tools';
  } else if (lowerTool.includes('report') || lowerTool.includes('analytics')) {
    return 'analytics_tools';
  } else {
    return 'other_tools';
  }
}