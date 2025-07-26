/**
 * 🔥 Google Analytics 4 Service - Elite Analytics Implementation
 * 
 * Enterprise-grade analytics tracking with:
 * - Custom events for DFS optimization
 * - E-commerce tracking for subscriptions
 * - User behavior analysis
 * - Conversion funnel optimization
 * - Real-time performance monitoring
 * - Privacy-compliant tracking
 * 
 * @version 2025.1.0
 */

import { gtag } from './gtag';
import { logger } from '../logging/logger';
import { supabase } from '../supabase/client';

// GA4 Event Types
export enum GA4EventType {
  // User Engagement
  LOGIN = 'login',
  SIGN_UP = 'sign_up',
  USER_ENGAGEMENT = 'user_engagement',
  
  // DFS Events
  LINEUP_CREATED = 'lineup_created',
  LINEUP_OPTIMIZED = 'lineup_optimized',
  LINEUP_EXPORTED = 'lineup_exported',
  CONTEST_ENTERED = 'contest_entered',
  
  // ML/AI Events
  PREDICTION_GENERATED = 'prediction_generated',
  AI_CHAT_INTERACTION = 'ai_chat_interaction',
  PATTERN_DISCOVERED = 'pattern_discovered',
  
  // Trading Events
  TRADE_ANALYZED = 'trade_analyzed',
  WAIVER_CLAIMED = 'waiver_claimed',
  PLAYER_ADDED = 'player_added',
  PLAYER_DROPPED = 'player_dropped',
  
  // Revenue Events
  PURCHASE = 'purchase',
  REFUND = 'refund',
  SUBSCRIPTION_START = 'subscription_start',
  SUBSCRIPTION_CANCEL = 'subscription_cancel',
  
  // Feature Usage
  FEATURE_USED = 'feature_used',
  TOOL_OPENED = 'tool_opened',
  REPORT_GENERATED = 'report_generated',
  
  // Performance
  PAGE_VIEW = 'page_view',
  TIMING_COMPLETE = 'timing_complete',
  EXCEPTION = 'exception'
}

// Custom Dimensions
export interface CustomDimensions {
  user_tier?: 'free' | 'pro' | 'elite';
  sport_preference?: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'multi';
  dfs_platform?: 'draftkings' | 'fanduel' | 'yahoo' | 'multiple';
  experience_level?: 'beginner' | 'intermediate' | 'expert';
  device_category?: 'mobile' | 'tablet' | 'desktop';
  ml_model_version?: string;
  feature_flags?: string[];
}

// E-commerce Item
export interface GA4Item {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  currency?: string;
}

// Event Parameters
export interface GA4EventParams {
  [key: string]: any;
  value?: number;
  currency?: string;
  items?: GA4Item[];
  custom_dimensions?: CustomDimensions;
}

// User Properties
export interface GA4UserProperties {
  user_id?: string;
  user_tier?: string;
  total_lineups_created?: number;
  total_contests_entered?: number;
  favorite_sport?: string;
  signup_date?: string;
  last_active?: string;
  lifetime_value?: number;
  churn_risk?: 'low' | 'medium' | 'high';
}

// Configuration
const GA4_CONFIG = {
  measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID!,
  debug: process.env.NODE_ENV === 'development',
  sendPageViews: true,
  cookieFlags: 'SameSite=None;Secure',
  customDimensionMapping: {
    user_tier: 'dimension1',
    sport_preference: 'dimension2',
    dfs_platform: 'dimension3',
    experience_level: 'dimension4',
    ml_model_version: 'dimension5'
  }
};

/**
 * Elite Google Analytics 4 Service
 */
export class GoogleAnalyticsService {
  private static instance: GoogleAnalyticsService;
  private initialized = false;
  private userId: string | null = null;
  private userProperties: GA4UserProperties = {};
  private sessionId: string;
  private pageViewCount = 0;
  private eventQueue: Array<{ event: string; params: GA4EventParams }> = [];
  private batchTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): GoogleAnalyticsService {
    if (!GoogleAnalyticsService.instance) {
      GoogleAnalyticsService.instance = new GoogleAnalyticsService();
    }
    return GoogleAnalyticsService.instance;
  }

  /**
   * Initialize GA4
   */
  async initialize(): Promise<void> {
    try {
      if (this.initialized) return;

      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        logger.warn('GA4 can only be initialized in browser environment');
        return;
      }

      // Load gtag script
      await this.loadGtagScript();

      // Initialize gtag
      window.gtag = window.gtag || function() {
        (window.dataLayer = window.dataLayer || []).push(arguments);
      };

      // Configure GA4
      gtag('js', new Date());
      gtag('config', GA4_CONFIG.measurementId, {
        send_page_view: false, // We'll send manually
        debug_mode: GA4_CONFIG.debug,
        cookie_flags: GA4_CONFIG.cookieFlags,
        session_id: this.sessionId
      });

      // Set up user
      await this.setupUser();

      // Track initial page view
      if (GA4_CONFIG.sendPageViews) {
        this.trackPageView();
      }

      // Set up performance observer
      this.setupPerformanceObserver();

      // Set up error tracking
      this.setupErrorTracking();

      this.initialized = true;
      logger.info('GA4 initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize GA4:', error);
    }
  }

  /**
   * Load gtag script
   */
  private async loadGtagScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src*="gtag/js?id=${GA4_CONFIG.measurementId}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_CONFIG.measurementId}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load GA4 script'));
      document.head.appendChild(script);
    });
  }

  /**
   * Set up user identification
   */
  private async setupUser(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        this.userId = user.id;
        
        // Set user ID in GA4
        gtag('set', { user_id: user.id });
        
        // Load user properties from database
        await this.loadUserProperties(user.id);
        
        // Set user properties in GA4
        this.setUserProperties(this.userProperties);
      }
    } catch (error) {
      logger.error('Failed to setup GA4 user:', error);
    }
  }

  /**
   * Load user properties from database
   */
  private async loadUserProperties(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      this.userProperties = {
        user_id: userId,
        user_tier: data.user_tier,
        total_lineups_created: data.total_lineups_created,
        total_contests_entered: data.total_contests_entered,
        favorite_sport: data.favorite_sport,
        signup_date: data.created_at,
        last_active: new Date().toISOString(),
        lifetime_value: data.lifetime_value,
        churn_risk: this.calculateChurnRisk(data)
      };
    } catch (error) {
      logger.error('Failed to load user properties:', error);
    }
  }

  /**
   * Calculate churn risk based on user activity
   */
  private calculateChurnRisk(userData: any): 'low' | 'medium' | 'high' {
    const daysSinceLastActive = Math.floor(
      (Date.now() - new Date(userData.last_active).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActive < 7 && userData.total_lineups_created > 10) {
      return 'low';
    } else if (daysSinceLastActive < 30) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Track event
   */
  trackEvent(eventName: GA4EventType | string, params?: GA4EventParams): void {
    if (!this.initialized) {
      this.queueEvent(eventName, params || {});
      return;
    }

    try {
      // Add session and user context
      const enrichedParams = {
        ...params,
        session_id: this.sessionId,
        page_location: window.location.href,
        page_title: document.title,
        user_tier: this.userProperties.user_tier,
        engagement_time_msec: this.getEngagementTime()
      };

      // Map custom dimensions
      if (params?.custom_dimensions) {
        Object.entries(params.custom_dimensions).forEach(([key, value]) => {
          const dimensionKey = GA4_CONFIG.customDimensionMapping[key as keyof typeof GA4_CONFIG.customDimensionMapping];
          if (dimensionKey) {
            enrichedParams[dimensionKey] = value;
          }
        });
      }

      // Send event
      gtag('event', eventName, enrichedParams);

      // Log in development
      if (GA4_CONFIG.debug) {
        logger.info(`GA4 Event: ${eventName}`, enrichedParams);
      }

      // Update user properties if needed
      this.updateUserPropertiesFromEvent(eventName, params);

    } catch (error) {
      logger.error('Failed to track event:', error);
    }
  }

  /**
   * Queue event for later sending
   */
  private queueEvent(event: string, params: GA4EventParams): void {
    this.eventQueue.push({ event, params });
    
    // Set up batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processEventQueue(), 1000);
    }
  }

  /**
   * Process queued events
   */
  private processEventQueue(): void {
    if (!this.initialized || this.eventQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];
    this.batchTimer = null;

    events.forEach(({ event, params }) => {
      this.trackEvent(event, params);
    });
  }

  /**
   * Track page view
   */
  trackPageView(params?: {
    page_path?: string;
    page_title?: string;
    page_location?: string;
  }): void {
    this.pageViewCount++;

    this.trackEvent(GA4EventType.PAGE_VIEW, {
      page_path: params?.page_path || window.location.pathname,
      page_title: params?.page_title || document.title,
      page_location: params?.page_location || window.location.href,
      page_referrer: document.referrer,
      page_view_count: this.pageViewCount
    });
  }

  /**
   * Track DFS lineup creation
   */
  trackLineupCreated(params: {
    sport: string;
    platform: string;
    contest_type: string;
    lineup_count: number;
    total_salary_used: number;
    optimization_used: boolean;
    ml_predictions_used: boolean;
  }): void {
    this.trackEvent(GA4EventType.LINEUP_CREATED, {
      ...params,
      value: params.lineup_count,
      custom_dimensions: {
        sport_preference: params.sport as any,
        dfs_platform: params.platform as any
      }
    });
  }

  /**
   * Track ML prediction
   */
  trackPrediction(params: {
    model_type: string;
    sport: string;
    prediction_type: string;
    confidence: number;
    accuracy?: number;
  }): void {
    this.trackEvent(GA4EventType.PREDICTION_GENERATED, {
      ...params,
      value: params.confidence,
      custom_dimensions: {
        ml_model_version: params.model_type
      }
    });
  }

  /**
   * Track purchase/subscription
   */
  trackPurchase(params: {
    transaction_id: string;
    value: number;
    currency: string;
    items: GA4Item[];
    tax?: number;
    shipping?: number;
    coupon?: string;
  }): void {
    this.trackEvent(GA4EventType.PURCHASE, params);
    
    // Update lifetime value
    if (this.userProperties.lifetime_value !== undefined) {
      this.userProperties.lifetime_value += params.value;
      this.setUserProperties({ lifetime_value: this.userProperties.lifetime_value });
    }
  }

  /**
   * Track subscription events
   */
  trackSubscription(action: 'start' | 'cancel' | 'upgrade' | 'downgrade', params: {
    subscription_id: string;
    plan_name: string;
    plan_price: number;
    billing_period: 'monthly' | 'yearly';
  }): void {
    const eventMap = {
      start: GA4EventType.SUBSCRIPTION_START,
      cancel: GA4EventType.SUBSCRIPTION_CANCEL,
      upgrade: GA4EventType.PURCHASE,
      downgrade: GA4EventType.REFUND
    };

    this.trackEvent(eventMap[action], {
      ...params,
      value: params.plan_price,
      currency: 'USD'
    });

    // Update user tier
    if (action === 'start' || action === 'upgrade') {
      const tier = params.plan_name.toLowerCase().includes('elite') ? 'elite' : 
                   params.plan_name.toLowerCase().includes('pro') ? 'pro' : 'free';
      this.setUserProperties({ user_tier: tier });
    }
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(featureName: string, params?: {
    feature_category?: string;
    feature_value?: any;
    success?: boolean;
  }): void {
    this.trackEvent(GA4EventType.FEATURE_USED, {
      feature_name: featureName,
      ...params
    });
  }

  /**
   * Track timing
   */
  trackTiming(params: {
    name: string;
    value: number; // milliseconds
    category?: string;
    label?: string;
  }): void {
    this.trackEvent(GA4EventType.TIMING_COMPLETE, {
      ...params,
      event_category: params.category || 'performance',
      event_label: params.label
    });
  }

  /**
   * Track exceptions
   */
  trackException(params: {
    description: string;
    fatal?: boolean;
    error?: Error;
  }): void {
    this.trackEvent(GA4EventType.EXCEPTION, {
      description: params.description,
      fatal: params.fatal || false,
      error_name: params.error?.name,
      error_message: params.error?.message,
      error_stack: params.error?.stack?.substring(0, 500) // Limit stack trace length
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Partial<GA4UserProperties>): void {
    if (!this.initialized) return;

    try {
      // Update local properties
      this.userProperties = { ...this.userProperties, ...properties };

      // Send to GA4
      gtag('set', { user_properties: properties });

      // Persist to database
      if (this.userId) {
        this.persistUserProperties(this.userId, properties);
      }
    } catch (error) {
      logger.error('Failed to set user properties:', error);
    }
  }

  /**
   * Persist user properties to database
   */
  private async persistUserProperties(
    userId: string, 
    properties: Partial<GA4UserProperties>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_analytics')
        .upsert({
          user_id: userId,
          ...properties,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to persist user properties:', error);
    }
  }

  /**
   * Update user properties from events
   */
  private updateUserPropertiesFromEvent(eventName: string, params?: GA4EventParams): void {
    switch (eventName) {
      case GA4EventType.LINEUP_CREATED:
        if (this.userProperties.total_lineups_created !== undefined) {
          this.userProperties.total_lineups_created++;
          this.setUserProperties({ 
            total_lineups_created: this.userProperties.total_lineups_created 
          });
        }
        break;

      case GA4EventType.CONTEST_ENTERED:
        if (this.userProperties.total_contests_entered !== undefined) {
          this.userProperties.total_contests_entered++;
          this.setUserProperties({ 
            total_contests_entered: this.userProperties.total_contests_entered 
          });
        }
        break;
    }
  }

  /**
   * Get engagement time
   */
  private getEngagementTime(): number {
    return performance.now();
  }

  /**
   * Set up performance observer
   */
  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        // Observe Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          
          this.trackTiming({
            name: 'LCP',
            value: lastEntry.renderTime || lastEntry.loadTime,
            category: 'Web Vitals'
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.trackTiming({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              category: 'Web Vitals'
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Observe Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          
          this.trackTiming({
            name: 'CLS',
            value: clsValue * 1000, // Convert to milliseconds
            category: 'Web Vitals'
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

      } catch (error) {
        logger.error('Failed to setup performance observer:', error);
      }
    }
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.trackException({
        description: event.message,
        fatal: false,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.trackException({
        description: `Unhandled Promise Rejection: ${event.reason}`,
        fatal: false
      });
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get user properties
   */
  getUserProperties(): GA4UserProperties {
    return { ...this.userProperties };
  }

  /**
   * Reset user (for logout)
   */
  resetUser(): void {
    this.userId = null;
    this.userProperties = {};
    gtag('set', { user_id: null });
  }

  /**
   * Enable debug mode
   */
  enableDebugMode(): void {
    gtag('set', { debug_mode: true });
  }

  /**
   * Disable debug mode
   */
  disableDebugMode(): void {
    gtag('set', { debug_mode: false });
  }
}

// Export singleton instance
export const ga4Service = GoogleAnalyticsService.getInstance();