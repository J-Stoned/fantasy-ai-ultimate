/**
 * 🌐 SOCIAL SHARING FEATURES
 * Share predictions, achievements, and results
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ShareableContent {
  id: string;
  type: 'prediction' | 'achievement' | 'streak' | 'leaderboard' | 'profit';
  userId: string;
  title: string;
  description: string;
  image?: string;
  data: any;
  shareUrl: string;
  platforms: {
    twitter: boolean;
    facebook: boolean;
    instagram: boolean;
    discord: boolean;
    telegram: boolean;
  };
  stats: {
    shares: number;
    views: number;
    likes: number;
    comments: number;
  };
  createdAt: Date;
}

export interface ShareTemplate {
  id: string;
  name: string;
  type: string;
  template: {
    title: string;
    body: string;
    hashtags: string[];
    image?: string;
  };
  variables: string[];
}

export class SocialSharingService {
  private baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fantasy-ai.com';
  
  /**
   * Create shareable prediction
   */
  async sharePrediction(userId: string, prediction: any): Promise<ShareableContent> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `${this.baseUrl}/share/prediction/${shareId}`;
    
    const content: ShareableContent = {
      id: shareId,
      type: 'prediction',
      userId,
      title: `🎯 ${prediction.confidence >= 0.8 ? 'HIGH CONFIDENCE' : ''} Prediction: ${prediction.homeTeam} vs ${prediction.awayTeam}`,
      description: `I'm predicting ${prediction.winner} to win with ${(prediction.confidence * 100).toFixed(1)}% confidence! 🏀`,
      data: prediction,
      shareUrl,
      platforms: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true,
        telegram: true
      },
      stats: {
        shares: 0,
        views: 0,
        likes: 0,
        comments: 0
      },
      createdAt: new Date()
    };
    
    // Store in database
    await this.saveShareableContent(content);
    
    return content;
  }
  
  /**
   * Share achievement/badge
   */
  async shareAchievement(userId: string, achievement: any): Promise<ShareableContent> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `${this.baseUrl}/share/achievement/${shareId}`;
    
    const content: ShareableContent = {
      id: shareId,
      type: 'achievement',
      userId,
      title: `🏆 New Achievement Unlocked: ${achievement.name}!`,
      description: achievement.description,
      image: this.generateAchievementImage(achievement),
      data: achievement,
      shareUrl,
      platforms: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true,
        telegram: true
      },
      stats: {
        shares: 0,
        views: 0,
        likes: 0,
        comments: 0
      },
      createdAt: new Date()
    };
    
    await this.saveShareableContent(content);
    return content;
  }
  
  /**
   * Share winning streak
   */
  async shareStreak(userId: string, streak: number, predictions: any[]): Promise<ShareableContent> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `${this.baseUrl}/share/streak/${shareId}`;
    
    const content: ShareableContent = {
      id: shareId,
      type: 'streak',
      userId,
      title: `🔥 I'm on a ${streak}-game win streak!`,
      description: `My last ${streak} predictions have all been correct! Join me on Fantasy AI for expert sports predictions.`,
      image: this.generateStreakImage(streak),
      data: { streak, predictions },
      shareUrl,
      platforms: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true,
        telegram: true
      },
      stats: {
        shares: 0,
        views: 0,
        likes: 0,
        comments: 0
      },
      createdAt: new Date()
    };
    
    await this.saveShareableContent(content);
    return content;
  }
  
  /**
   * Share leaderboard position
   */
  async shareLeaderboardPosition(userId: string, position: any): Promise<ShareableContent> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `${this.baseUrl}/share/leaderboard/${shareId}`;
    
    const emoji = position.rank === 1 ? '🥇' : position.rank === 2 ? '🥈' : position.rank === 3 ? '🥉' : '🏆';
    
    const content: ShareableContent = {
      id: shareId,
      type: 'leaderboard',
      userId,
      title: `${emoji} Ranked #${position.rank} on Fantasy AI!`,
      description: `${(position.stats.accuracy * 100).toFixed(1)}% accuracy with ${position.stats.totalPredictions} predictions. Join the competition!`,
      image: this.generateLeaderboardImage(position),
      data: position,
      shareUrl,
      platforms: {
        twitter: true,
        facebook: true,
        instagram: true,
        discord: true,
        telegram: true
      },
      stats: {
        shares: 0,
        views: 0,
        likes: 0,
        comments: 0
      },
      createdAt: new Date()
    };
    
    await this.saveShareableContent(content);
    return content;
  }
  
  /**
   * Generate share links for platforms
   */
  generateShareLinks(content: ShareableContent): Record<string, string> {
    const encodedUrl = encodeURIComponent(content.shareUrl);
    const encodedTitle = encodeURIComponent(content.title);
    const encodedDescription = encodeURIComponent(content.description);
    
    const hashtags = this.getHashtags(content.type);
    const encodedHashtags = encodeURIComponent(hashtags.join(','));
    
    return {
      twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}%20${encodedDescription}&url=${encodedUrl}&hashtags=${encodedHashtags}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}%20${encodedDescription}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedDescription}%20${encodedUrl}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    };
  }
  
  /**
   * Get share templates
   */
  getShareTemplates(): ShareTemplate[] {
    return [
      {
        id: 'prediction_confident',
        name: 'High Confidence Prediction',
        type: 'prediction',
        template: {
          title: '🎯 {confidence}% Confident: {team} to win!',
          body: 'My AI-powered prediction system is showing {confidence}% confidence that {team} will beat {opponent}. Check it out on Fantasy AI!',
          hashtags: ['FantasyAI', 'SportsPredictions', 'AI', 'Sports']
        },
        variables: ['confidence', 'team', 'opponent']
      },
      {
        id: 'streak_milestone',
        name: 'Winning Streak',
        type: 'streak',
        template: {
          title: '🔥 {streak} Wins in a Row!',
          body: "I'm on fire with {streak} correct predictions in a row! My accuracy is now {accuracy}%. Join me on Fantasy AI!",
          hashtags: ['WinningStreak', 'FantasyAI', 'SportsBetting']
        },
        variables: ['streak', 'accuracy']
      },
      {
        id: 'profit_milestone',
        name: 'Profit Milestone',
        type: 'profit',
        template: {
          title: '💰 +${profit} in Profits!',
          body: 'Just hit ${profit} in profits with {roi}% ROI using Fantasy AI predictions. The future of sports betting is here!',
          hashtags: ['ProfitableBetting', 'FantasyAI', 'ROI']
        },
        variables: ['profit', 'roi']
      },
      {
        id: 'leaderboard_top',
        name: 'Leaderboard Achievement',
        type: 'leaderboard',
        template: {
          title: '🏆 #{rank} on the Leaderboard!',
          body: 'Just reached #{rank} on Fantasy AI with {accuracy}% accuracy! Challenge me at fantasy-ai.com',
          hashtags: ['FantasyAI', 'Leaderboard', 'TopPredictor']
        },
        variables: ['rank', 'accuracy']
      }
    ];
  }
  
  /**
   * Track share interaction
   */
  async trackShare(shareId: string, platform: string) {
    const { data: content } = await supabase
      .from('shareable_content')
      .select('stats')
      .eq('id', shareId)
      .single();
    
    if (content) {
      content.stats.shares++;
      
      await supabase
        .from('shareable_content')
        .update({ stats: content.stats })
        .eq('id', shareId);
      
      // Track platform-specific share
      await supabase
        .from('share_analytics')
        .insert({
          share_id: shareId,
          platform,
          action: 'share',
          timestamp: new Date()
        });
    }
  }
  
  /**
   * Track share view
   */
  async trackView(shareId: string) {
    const { data: content } = await supabase
      .from('shareable_content')
      .select('stats')
      .eq('id', shareId)
      .single();
    
    if (content) {
      content.stats.views++;
      
      await supabase
        .from('shareable_content')
        .update({ stats: content.stats })
        .eq('id', shareId);
    }
  }
  
  /**
   * Get share analytics
   */
  async getShareAnalytics(userId: string) {
    const { data: shares } = await supabase
      .from('shareable_content')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (!shares) return null;
    
    const totalShares = shares.reduce((sum, s) => sum + s.stats.shares, 0);
    const totalViews = shares.reduce((sum, s) => sum + s.stats.views, 0);
    const totalLikes = shares.reduce((sum, s) => sum + s.stats.likes, 0);
    
    const byType = shares.reduce((acc, share) => {
      if (!acc[share.type]) {
        acc[share.type] = { count: 0, shares: 0, views: 0 };
      }
      acc[share.type].count++;
      acc[share.type].shares += share.stats.shares;
      acc[share.type].views += share.stats.views;
      return acc;
    }, {} as Record<string, any>);
    
    const mostShared = shares.sort((a, b) => b.stats.shares - a.stats.shares)[0];
    const mostViewed = shares.sort((a, b) => b.stats.views - a.stats.views)[0];
    
    return {
      totalContent: shares.length,
      totalShares,
      totalViews,
      totalLikes,
      avgSharesPerContent: totalShares / shares.length,
      avgViewsPerContent: totalViews / shares.length,
      byType,
      mostShared,
      mostViewed,
      recentShares: shares.slice(0, 10)
    };
  }
  
  /**
   * Save shareable content
   */
  private async saveShareableContent(content: ShareableContent) {
    await supabase.from('shareable_content').insert({
      id: content.id,
      type: content.type,
      user_id: content.userId,
      title: content.title,
      description: content.description,
      image: content.image,
      data: content.data,
      share_url: content.shareUrl,
      platforms: content.platforms,
      stats: content.stats,
      created_at: content.createdAt
    });
  }
  
  /**
   * Generate achievement image
   */
  private generateAchievementImage(achievement: any): string {
    // In production, would generate actual image
    return `${this.baseUrl}/api/og/achievement/${achievement.id}`;
  }
  
  /**
   * Generate streak image
   */
  private generateStreakImage(streak: number): string {
    return `${this.baseUrl}/api/og/streak/${streak}`;
  }
  
  /**
   * Generate leaderboard image
   */
  private generateLeaderboardImage(position: any): string {
    return `${this.baseUrl}/api/og/leaderboard/${position.rank}`;
  }
  
  /**
   * Get hashtags for content type
   */
  private getHashtags(type: string): string[] {
    const baseHashtags = ['FantasyAI', 'SportsPredictions'];
    
    switch (type) {
      case 'prediction':
        return [...baseHashtags, 'AIpredictions', 'SportsBetting'];
      case 'achievement':
        return [...baseHashtags, 'Achievement', 'Gaming'];
      case 'streak':
        return [...baseHashtags, 'WinningStreak', 'OnFire'];
      case 'leaderboard':
        return [...baseHashtags, 'Leaderboard', 'TopPlayer'];
      case 'profit':
        return [...baseHashtags, 'Profits', 'ROI'];
      default:
        return baseHashtags;
    }
  }
}