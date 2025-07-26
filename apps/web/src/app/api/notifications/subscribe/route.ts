/**
 * 🔥 FCM Topic Subscription API
 * 
 * Manages topic subscriptions for targeted notifications
 * Topics include: sports, teams, players, contest types
 */

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { logger } from '../../../../lib/logging/logger';
import { createClient } from '@supabase/supabase-js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  } catch (error) {
    logger.error('Firebase admin initialization error:', error);
  }
}

const messaging = admin.messaging();

// Initialize Supabase Admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valid topic patterns
const VALID_TOPICS = {
  SPORTS: /^sport_(nfl|nba|mlb|nhl)$/,
  TEAMS: /^team_[a-zA-Z0-9_]+$/,
  PLAYERS: /^player_[a-zA-Z0-9_]+$/,
  CONTESTS: /^contest_(gpp|cash|h2h|league)$/,
  ALERTS: /^alerts_(injuries|news|lineups|weather)$/,
  DFS: /^dfs_(dk|fd|yahoo)_[a-zA-Z0-9_]+$/
};

export async function POST(request: NextRequest) {
  try {
    const { token, topic, action = 'subscribe' } = await request.json();

    // Validate inputs
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!topic || !isValidTopic(topic)) {
      return NextResponse.json(
        { error: 'Invalid topic format' },
        { status: 400 }
      );
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Perform subscription/unsubscription
    if (action === 'subscribe') {
      await messaging.subscribeToTopic([token], topic);
      
      // Track subscription in database
      await trackSubscription(user.id, topic, true);
      
      logger.info(`User ${user.id} subscribed to topic: ${topic}`);
      
      return NextResponse.json({
        success: true,
        message: `Subscribed to ${topic}`,
        topic
      });
      
    } else if (action === 'unsubscribe') {
      await messaging.unsubscribeFromTopic([token], topic);
      
      // Remove subscription from database
      await trackSubscription(user.id, topic, false);
      
      logger.info(`User ${user.id} unsubscribed from topic: ${topic}`);
      
      return NextResponse.json({
        success: true,
        message: `Unsubscribed from ${topic}`,
        topic
      });
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use subscribe or unsubscribe' },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.error('Topic subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to manage topic subscription' },
      { status: 500 }
    );
  }
}

/**
 * Validate topic against allowed patterns
 */
function isValidTopic(topic: string): boolean {
  return Object.values(VALID_TOPICS).some(pattern => pattern.test(topic));
}

/**
 * Track topic subscription in database
 */
async function trackSubscription(
  userId: string,
  topic: string,
  isSubscribed: boolean
): Promise<void> {
  try {
    if (isSubscribed) {
      // Add subscription
      await supabaseAdmin
        .from('notification_topics')
        .upsert({
          user_id: userId,
          topic: topic,
          subscribed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,topic'
        });
    } else {
      // Remove subscription
      await supabaseAdmin
        .from('notification_topics')
        .delete()
        .eq('user_id', userId)
        .eq('topic', topic);
    }
  } catch (error) {
    logger.error('Failed to track subscription:', error);
  }
}

/**
 * GET endpoint to retrieve user's subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Get user's subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from('notification_topics')
      .select('topic, subscribed_at')
      .eq('user_id', user.id)
      .order('subscribed_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Group subscriptions by type
    const grouped = {
      sports: [] as string[],
      teams: [] as string[],
      players: [] as string[],
      contests: [] as string[],
      alerts: [] as string[],
      dfs: [] as string[]
    };

    subscriptions?.forEach(sub => {
      if (sub.topic.startsWith('sport_')) {
        grouped.sports.push(sub.topic);
      } else if (sub.topic.startsWith('team_')) {
        grouped.teams.push(sub.topic);
      } else if (sub.topic.startsWith('player_')) {
        grouped.players.push(sub.topic);
      } else if (sub.topic.startsWith('contest_')) {
        grouped.contests.push(sub.topic);
      } else if (sub.topic.startsWith('alerts_')) {
        grouped.alerts.push(sub.topic);
      } else if (sub.topic.startsWith('dfs_')) {
        grouped.dfs.push(sub.topic);
      }
    });

    return NextResponse.json({
      success: true,
      subscriptions: grouped,
      total: subscriptions?.length || 0
    });

  } catch (error) {
    logger.error('Failed to get subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve subscriptions' },
      { status: 500 }
    );
  }
}