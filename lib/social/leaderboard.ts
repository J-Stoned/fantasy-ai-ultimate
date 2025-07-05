/**
 * 🏆 PREDICTION LEADERBOARD SYSTEM
 * Track and rank user prediction performance
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatar?: string;
  rank: number;
  previousRank?: number;
  stats: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    streak: number;
    bestStreak: number;
    highConfidenceAccuracy: number;
    profitLoss: number;
    roi: number; // Return on investment
  };
  badges: Badge[];
  score: number;
  trend: 'up' | 'down' | 'same';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: Date;
}

export interface LeaderboardOptions {
  period: 'daily' | 'weekly' | 'monthly' | 'allTime';
  sport?: string;
  team?: string;
  minPredictions?: number;
  includeInactive?: boolean;
}

export class LeaderboardSystem {
  private cache = new Map<string, { data: LeaderboardEntry[]; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get leaderboard
   */
  async getLeaderboard(options: LeaderboardOptions = { period: 'weekly' }): Promise<LeaderboardEntry[]> {
    const cacheKey = JSON.stringify(options);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Calculate date range
    const dateRange = this.getDateRange(options.period);
    
    // Query user predictions
    let query = supabase
      .from('user_predictions')
      .select('*')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    if (options.sport) {
      query = query.eq('sport', options.sport);
    }

    const { data: predictions, error } = await query;

    if (error || !predictions) {
      console.error(chalk.red('Failed to load predictions:'), error);
      return [];
    }

    // Group by user and calculate stats
    const userStats = this.calculateUserStats(predictions, options);
    
    // Get user profiles
    const userIds = Object.keys(userStats);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, avatar')
      .in('user_id', userIds);

    // Build leaderboard entries
    const entries: LeaderboardEntry[] = [];
    
    for (const userId of userIds) {
      const stats = userStats[userId];
      const profile = profiles?.find(p => p.user_id === userId);
      
      if (!options.includeInactive && stats.totalPredictions < (options.minPredictions || 10)) {
        continue;
      }

      const badges = await this.getUserBadges(userId, stats);
      const score = this.calculateScore(stats);

      entries.push({
        userId,
        displayName: profile?.display_name || `User ${userId.substr(0, 8)}`,
        avatar: profile?.avatar,
        rank: 0, // Will be set after sorting
        stats,
        badges,
        score,
        trend: 'same'
      });
    }

    // Sort by score
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks and trends
    const previousLeaderboard = await this.getPreviousLeaderboard(options);
    
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      
      const previousEntry = previousLeaderboard.find(e => e.userId === entry.userId);
      if (previousEntry) {
        entry.previousRank = previousEntry.rank;
        if (entry.rank < previousEntry.rank) entry.trend = 'up';
        else if (entry.rank > previousEntry.rank) entry.trend = 'down';
      }
    });

    // Cache results
    this.cache.set(cacheKey, {
      data: entries,
      timestamp: Date.now()
    });

    return entries;
  }

  /**
   * Get user rank
   */
  async getUserRank(userId: string, options: LeaderboardOptions = { period: 'weekly' }): Promise<LeaderboardEntry | null> {
    const leaderboard = await this.getLeaderboard(options);
    return leaderboard.find(entry => entry.userId === userId) || null;
  }

  /**
   * Calculate user statistics
   */
  private calculateUserStats(predictions: any[], options: LeaderboardOptions): Record<string, any> {
    const userStats: Record<string, any> = {};

    predictions.forEach(pred => {
      if (!userStats[pred.user_id]) {
        userStats[pred.user_id] = {
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
          streak: 0,
          bestStreak: 0,
          highConfidenceAccuracy: 0,
          highConfidencePredictions: 0,
          highConfidenceCorrect: 0,
          profitLoss: 0,
          roi: 0,
          recentPredictions: []
        };
      }

      const stats = userStats[pred.user_id];
      stats.totalPredictions++;
      
      if (pred.is_correct) {
        stats.correctPredictions++;
      }

      if (pred.confidence > 0.7) {
        stats.highConfidencePredictions++;
        if (pred.is_correct) {
          stats.highConfidenceCorrect++;
        }
      }

      // Calculate profit/loss (assuming $100 bets)
      if (pred.is_correct) {
        stats.profitLoss += 90; // Assuming -110 odds
      } else {
        stats.profitLoss -= 100;
      }

      // Track recent predictions for streak
      stats.recentPredictions.push({
        date: new Date(pred.created_at),
        correct: pred.is_correct
      });
    });

    // Calculate final stats
    Object.values(userStats).forEach(stats => {
      stats.accuracy = stats.totalPredictions > 0 
        ? stats.correctPredictions / stats.totalPredictions 
        : 0;

      stats.highConfidenceAccuracy = stats.highConfidencePredictions > 0
        ? stats.highConfidenceCorrect / stats.highConfidencePredictions
        : 0;

      stats.roi = stats.totalPredictions > 0
        ? (stats.profitLoss / (stats.totalPredictions * 100)) * 100
        : 0;

      // Calculate streaks
      stats.recentPredictions.sort((a: any, b: any) => b.date - a.date);
      let currentStreak = 0;
      let bestStreak = 0;

      stats.recentPredictions.forEach((pred: any) => {
        if (pred.correct) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });

      stats.streak = currentStreak;
      stats.bestStreak = bestStreak;

      // Clean up temp data
      delete stats.recentPredictions;
      delete stats.highConfidencePredictions;
      delete stats.highConfidenceCorrect;
    });

    return userStats;
  }

  /**
   * Calculate user score
   */
  private calculateScore(stats: any): number {
    // Weighted scoring system
    const weights = {
      accuracy: 1000,
      volume: 0.5,
      highConfAccuracy: 500,
      streak: 50,
      profit: 0.1
    };

    let score = 0;

    // Accuracy component (most important)
    score += stats.accuracy * weights.accuracy;

    // Volume component (rewards activity)
    score += Math.min(stats.totalPredictions, 1000) * weights.volume;

    // High confidence accuracy (rewards good judgment)
    score += stats.highConfidenceAccuracy * weights.highConfAccuracy;

    // Streak bonus
    score += stats.streak * weights.streak;

    // Profit component
    score += Math.max(0, stats.profitLoss) * weights.profit;

    // Penalties
    if (stats.accuracy < 0.4 && stats.totalPredictions > 20) {
      score *= 0.8; // 20% penalty for poor performance
    }

    return Math.round(score);
  }

  /**
   * Get user badges
   */
  private async getUserBadges(userId: string, stats: any): Promise<Badge[]> {
    const badges: Badge[] = [];

    // Accuracy badges
    if (stats.accuracy >= 0.7 && stats.totalPredictions >= 50) {
      badges.push({
        id: 'accuracy_master',
        name: 'Accuracy Master',
        description: '70%+ accuracy with 50+ predictions',
        icon: '🎯',
        rarity: 'epic',
        earnedAt: new Date()
      });
    }

    if (stats.accuracy >= 0.6 && stats.totalPredictions >= 20) {
      badges.push({
        id: 'sharp_shooter',
        name: 'Sharp Shooter',
        description: '60%+ accuracy',
        icon: '🎪',
        rarity: 'rare',
        earnedAt: new Date()
      });
    }

    // Streak badges
    if (stats.bestStreak >= 10) {
      badges.push({
        id: 'hot_streak',
        name: 'Hot Streak',
        description: '10+ correct predictions in a row',
        icon: '🔥',
        rarity: 'epic',
        earnedAt: new Date()
      });
    }

    if (stats.streak >= 5) {
      badges.push({
        id: 'on_fire',
        name: 'On Fire',
        description: 'Current 5+ win streak',
        icon: '🌟',
        rarity: 'rare',
        earnedAt: new Date()
      });
    }

    // Volume badges
    if (stats.totalPredictions >= 1000) {
      badges.push({
        id: 'prediction_veteran',
        name: 'Prediction Veteran',
        description: '1000+ predictions made',
        icon: '🏅',
        rarity: 'legendary',
        earnedAt: new Date()
      });
    }

    if (stats.totalPredictions >= 100) {
      badges.push({
        id: 'active_predictor',
        name: 'Active Predictor',
        description: '100+ predictions made',
        icon: '📊',
        rarity: 'common',
        earnedAt: new Date()
      });
    }

    // Profit badges
    if (stats.roi >= 20) {
      badges.push({
        id: 'profit_king',
        name: 'Profit King',
        description: '20%+ ROI',
        icon: '👑',
        rarity: 'legendary',
        earnedAt: new Date()
      });
    }

    if (stats.profitLoss >= 1000) {
      badges.push({
        id: 'big_winner',
        name: 'Big Winner',
        description: '$1000+ in profits',
        icon: '💰',
        rarity: 'epic',
        earnedAt: new Date()
      });
    }

    // High confidence badge
    if (stats.highConfidenceAccuracy >= 0.8 && stats.totalPredictions >= 20) {
      badges.push({
        id: 'confidence_master',
        name: 'Confidence Master',
        description: '80%+ accuracy on high confidence picks',
        icon: '🎲',
        rarity: 'epic',
        earnedAt: new Date()
      });
    }

    return badges;
  }

  /**
   * Get date range for period
   */
  private getDateRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'allTime':
        start.setFullYear(2020);
        break;
    }

    return { start, end };
  }

  /**
   * Get previous leaderboard for trend calculation
   */
  private async getPreviousLeaderboard(options: LeaderboardOptions): Promise<LeaderboardEntry[]> {
    // For simplicity, return empty array
    // In production, would query historical leaderboard data
    return [];
  }

  /**
   * Get leaderboard insights
   */
  async getInsights(options: LeaderboardOptions = { period: 'weekly' }) {
    const leaderboard = await this.getLeaderboard(options);
    
    if (leaderboard.length === 0) {
      return null;
    }

    const topPerformers = leaderboard.slice(0, 10);
    const avgAccuracy = leaderboard.reduce((sum, e) => sum + e.stats.accuracy, 0) / leaderboard.length;
    const totalPredictions = leaderboard.reduce((sum, e) => sum + e.stats.totalPredictions, 0);
    
    const insights = {
      totalUsers: leaderboard.length,
      averageAccuracy: avgAccuracy,
      totalPredictions,
      topPerformer: leaderboard[0],
      biggestClimber: leaderboard
        .filter(e => e.previousRank && e.trend === 'up')
        .sort((a, b) => (b.previousRank! - b.rank) - (a.previousRank! - a.rank))[0],
      mostProfitable: leaderboard.sort((a, b) => b.stats.profitLoss - a.stats.profitLoss)[0],
      longestStreak: leaderboard.sort((a, b) => b.stats.bestStreak - a.stats.bestStreak)[0],
      mostActive: leaderboard.sort((a, b) => b.stats.totalPredictions - a.stats.totalPredictions)[0]
    };

    return insights;
  }
}