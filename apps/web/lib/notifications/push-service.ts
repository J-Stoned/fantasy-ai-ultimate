/**
 * 🔔 PUSH NOTIFICATION SERVICE
 * Sends real-time alerts for high-confidence predictions and arbitrage
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface NotificationPayload {
  id: string;
  type: 'prediction' | 'arbitrage' | 'game_start' | 'outcome' | 'streak';
  title: string;
  body: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  expiresAt?: Date;
}

export interface UserPreferences {
  userId: string;
  enabledTypes: string[];
  minConfidence: number;
  minArbitrageProfit: number;
  favoriteTeams: string[];
  notificationHours: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
}

export class PushNotificationService {
  private wsClients = new Map<string, WebSocket>();
  private notificationQueue: NotificationPayload[] = [];
  private userPreferences = new Map<string, UserPreferences>();

  constructor() {
    this.loadUserPreferences();
    this.startNotificationProcessor();
  }

  /**
   * Load user preferences from database
   */
  private async loadUserPreferences() {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*');

    if (prefs) {
      prefs.forEach(pref => {
        this.userPreferences.set(pref.user_id, pref);
      });
    }

    console.log(chalk.green(`✅ Loaded preferences for ${this.userPreferences.size} users`));
  }

  /**
   * Send high-confidence prediction notification
   */
  async sendPredictionAlert(prediction: any) {
    if (prediction.confidence < 0.75) return; // Only high confidence

    const notification: NotificationPayload = {
      id: `pred_${Date.now()}`,
      type: 'prediction',
      title: '🎯 High Confidence Pick!',
      body: `${prediction.homeTeam} vs ${prediction.awayTeam} - ${prediction.winner} to win (${(prediction.confidence * 100).toFixed(1)}% confidence)`,
      data: {
        gameId: prediction.gameId,
        prediction,
        models: prediction.modelCount
      },
      priority: prediction.confidence > 0.85 ? 'urgent' : 'high',
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    };

    await this.queueNotification(notification);
  }

  /**
   * Send arbitrage opportunity alert
   */
  async sendArbitrageAlert(opportunity: any) {
    if (opportunity.profit < 1) return; // Only profitable opportunities

    const notification: NotificationPayload = {
      id: `arb_${Date.now()}`,
      type: 'arbitrage',
      title: '💰 Arbitrage Opportunity!',
      body: `${opportunity.profit.toFixed(1)}% guaranteed profit - ${opportunity.homeTeam} vs ${opportunity.awayTeam}`,
      data: {
        opportunity,
        expiresIn: opportunity.timeWindow
      },
      priority: 'urgent',
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + opportunity.timeWindow * 60 * 1000)
    };

    await this.queueNotification(notification);
  }

  /**
   * Send game start reminder
   */
  async sendGameStartAlert(game: any) {
    const notification: NotificationPayload = {
      id: `game_${game.id}`,
      type: 'game_start',
      title: '🏀 Game Starting Soon!',
      body: `${game.homeTeam} vs ${game.awayTeam} starts in 15 minutes`,
      data: { game },
      priority: 'medium',
      timestamp: new Date(),
      expiresAt: new Date(game.startTime)
    };

    await this.queueNotification(notification);
  }

  /**
   * Send outcome notification (win/loss)
   */
  async sendOutcomeAlert(prediction: any, outcome: any) {
    const correct = prediction.winner === outcome.winner;
    
    const notification: NotificationPayload = {
      id: `outcome_${Date.now()}`,
      type: 'outcome',
      title: correct ? '✅ Prediction Correct!' : '❌ Prediction Missed',
      body: `${outcome.homeTeam} ${outcome.homeScore} - ${outcome.awayScore} ${outcome.awayTeam}`,
      data: {
        prediction,
        outcome,
        correct
      },
      priority: 'low',
      timestamp: new Date()
    };

    await this.queueNotification(notification);
  }

  /**
   * Send hot streak alert
   */
  async sendStreakAlert(streak: any) {
    const notification: NotificationPayload = {
      id: `streak_${Date.now()}`,
      type: 'streak',
      title: '🔥 Hot Streak Alert!',
      body: `${streak.team} has won ${streak.wins} games in a row!`,
      data: { streak },
      priority: 'medium',
      timestamp: new Date()
    };

    await this.queueNotification(notification);
  }

  /**
   * Queue notification for processing
   */
  private async queueNotification(notification: NotificationPayload) {
    this.notificationQueue.push(notification);
    
    // Store in database
    await supabase.from('notifications').insert({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.timestamp,
      expires_at: notification.expiresAt,
      status: 'queued'
    });
  }

  /**
   * Process notification queue
   */
  private startNotificationProcessor() {
    setInterval(async () => {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift()!;
        
        // Check if expired
        if (notification.expiresAt && notification.expiresAt < new Date()) {
          continue;
        }

        // Get eligible users
        const eligibleUsers = this.getEligibleUsers(notification);

        // Send via different channels
        for (const userId of eligibleUsers) {
          const prefs = this.userPreferences.get(userId);
          if (!prefs) continue;

          if (prefs.channels.push) {
            await this.sendPushNotification(userId, notification);
          }
          if (prefs.channels.inApp) {
            await this.sendInAppNotification(userId, notification);
          }
          if (prefs.channels.email && notification.priority === 'urgent') {
            await this.sendEmailNotification(userId, notification);
          }
        }

        // Update status
        await supabase
          .from('notifications')
          .update({ status: 'sent', sent_at: new Date() })
          .eq('id', notification.id);
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Get users eligible for notification
   */
  private getEligibleUsers(notification: NotificationPayload): string[] {
    const eligibleUsers: string[] = [];
    const currentHour = new Date().getHours();

    this.userPreferences.forEach((prefs, userId) => {
      // Check notification type
      if (!prefs.enabledTypes.includes(notification.type)) return;

      // Check time window
      if (currentHour < prefs.notificationHours.start || 
          currentHour > prefs.notificationHours.end) return;

      // Check confidence threshold
      if (notification.type === 'prediction' && 
          notification.data.prediction.confidence < prefs.minConfidence) return;

      // Check arbitrage threshold
      if (notification.type === 'arbitrage' && 
          notification.data.opportunity.profit < prefs.minArbitrageProfit) return;

      // Check favorite teams
      if (prefs.favoriteTeams.length > 0) {
        const hasTeam = prefs.favoriteTeams.some(team => 
          notification.body.includes(team)
        );
        if (!hasTeam && notification.priority !== 'urgent') return;
      }

      eligibleUsers.push(userId);
    });

    return eligibleUsers;
  }

  /**
   * Send push notification (web push)
   */
  private async sendPushNotification(userId: string, notification: NotificationPayload) {
    // In real implementation, would use web push API
    console.log(chalk.green(`📱 Push to ${userId}:`), notification.title);
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(userId: string, notification: NotificationPayload) {
    const ws = this.wsClients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(userId: string, notification: NotificationPayload) {
    // In real implementation, would use email service
    console.log(chalk.blue(`📧 Email to ${userId}:`), notification.title);
  }

  /**
   * Register WebSocket client for in-app notifications
   */
  registerClient(userId: string, ws: WebSocket) {
    this.wsClients.set(userId, ws);
    console.log(chalk.green(`✅ Registered client ${userId}`));

    ws.on('close', () => {
      this.wsClients.delete(userId);
      console.log(chalk.gray(`Client ${userId} disconnected`));
    });
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>) {
    const current = this.userPreferences.get(userId) || this.getDefaultPreferences(userId);
    const updated = { ...current, ...preferences };
    
    this.userPreferences.set(userId, updated);
    
    await supabase
      .from('user_preferences')
      .upsert(updated);
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      enabledTypes: ['prediction', 'arbitrage'],
      minConfidence: 0.75,
      minArbitrageProfit: 2,
      favoriteTeams: [],
      notificationHours: {
        start: 9,
        end: 22
      },
      channels: {
        push: true,
        email: false,
        sms: false,
        inApp: true
      }
    };
  }

  /**
   * Get notification statistics
   */
  async getStats() {
    const { data: sent } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { data: queued } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    return {
      sent24h: sent?.count || 0,
      queued: queued?.count || 0,
      activeUsers: this.wsClients.size,
      preferences: this.userPreferences.size
    };
  }
}