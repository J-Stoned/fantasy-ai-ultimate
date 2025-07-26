/**
 * 🔥 Send FCM Notification API Endpoint
 * 
 * Handles sending push notifications to specific users
 * Uses Firebase Admin SDK for server-side messaging
 */

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { logger } from '../../../../lib/logging/logger';
import { NotificationPayload } from '../../../../lib/services/notifications/fcm-service';

// Initialize Firebase Admin
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

export async function POST(request: NextRequest) {
  try {
    const { tokens, notification } = await request.json();

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 400 }
      );
    }

    if (!notification) {
      return NextResponse.json(
        { error: 'No notification payload provided' },
        { status: 400 }
      );
    }

    // Prepare FCM message
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image
      },
      data: {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        timestamp: notification.timestamp.toString(),
        ...notification.data
      },
      webpush: {
        headers: {
          TTL: '86400',
          Urgency: mapPriorityToUrgency(notification.priority)
        },
        notification: {
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: notification.badge || '/icons/badge-72x72.png',
          tag: notification.tag || notification.type,
          requireInteraction: notification.requireInteraction || false,
          vibrate: [200, 100, 200],
          actions: notification.actions?.map(action => ({
            action: action.action,
            title: action.title,
            icon: action.icon
          }))
        },
        fcmOptions: {
          link: notification.data?.deepLink || '/'
        }
      },
      android: {
        priority: notification.priority === 'critical' ? 'high' : 'normal',
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          channelId: `fantasy_ai_${notification.type}`,
          priority: mapPriorityToAndroid(notification.priority),
          vibrateTimingsMillis: [200, 100, 200]
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: notification.priority === 'critical' ? 'critical.caf' : 'default',
            badge: 1,
            threadId: notification.type,
            category: notification.type
          }
        },
        headers: {
          'apns-priority': notification.priority === 'critical' ? '10' : '5',
          'apns-expiration': Math.floor(Date.now() / 1000 + 86400).toString()
        }
      }
    };

    // Send multicast message
    const response = await messaging.sendEachForMulticast(message);
    
    // Log results
    logger.info(`FCM send results: ${response.successCount} successful, ${response.failureCount} failed`);

    // Handle failed tokens
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        logger.error(`FCM error for token ${tokens[idx]}:`, resp.error);
        failedTokens.push(tokens[idx]);
      }
    });

    // Clean up invalid tokens
    if (failedTokens.length > 0) {
      await cleanupInvalidTokens(failedTokens);
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens
    });

  } catch (error) {
    logger.error('Failed to send FCM notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

/**
 * Map priority to Web Push urgency
 */
function mapPriorityToUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
  switch (priority) {
    case 'critical':
      return 'high';
    case 'high':
      return 'high';
    case 'normal':
      return 'normal';
    case 'low':
      return 'low';
    default:
      return 'normal';
  }
}

/**
 * Map priority to Android notification priority
 */
function mapPriorityToAndroid(priority: string): 'min' | 'low' | 'default' | 'high' | 'max' {
  switch (priority) {
    case 'critical':
      return 'max';
    case 'high':
      return 'high';
    case 'normal':
      return 'default';
    case 'low':
      return 'low';
    default:
      return 'default';
  }
}

/**
 * Clean up invalid FCM tokens from database
 */
async function cleanupInvalidTokens(tokens: string[]): Promise<void> {
  try {
    // Import supabase admin client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
      .from('fcm_tokens')
      .delete()
      .in('token', tokens);

    if (error) {
      logger.error('Failed to cleanup invalid tokens:', error);
    } else {
      logger.info(`Cleaned up ${tokens.length} invalid FCM tokens`);
    }
  } catch (error) {
    logger.error('Error cleaning up tokens:', error);
  }
}