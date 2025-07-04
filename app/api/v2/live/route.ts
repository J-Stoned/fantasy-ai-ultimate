/**
 * 📱 LIVE UPDATES API
 * 
 * WebSocket connection info for mobile apps
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
  const host = request.headers.get('host') || 'localhost:8080';
  
  return NextResponse.json({
    websocket: {
      url: `${protocol}://${host}`,
      channels: [
        {
          name: 'predictions',
          description: 'Real-time game predictions',
          events: ['new_prediction', 'prediction_update']
        },
        {
          name: 'alerts',
          description: 'High confidence alerts',
          events: ['high_confidence_prediction', 'upset_alert']
        },
        {
          name: 'metrics',
          description: 'Model performance updates',
          events: ['model_accuracy', 'prediction_results']
        },
        {
          name: 'games',
          description: 'Game-specific updates',
          events: ['game_start', 'score_update', 'game_final']
        }
      ],
      authentication: {
        required: false,
        method: 'Bearer token in first message'
      }
    },
    example: {
      connect: `new WebSocket('${protocol}://${host}')`,
      subscribe: {
        type: 'subscribe',
        channels: ['predictions', 'alerts']
      },
      message: {
        type: 'predictions',
        data: {
          type: 'new_prediction',
          data: {
            gameId: '12345',
            prediction: {
              winner: 'home',
              confidence: 0.75
            }
          }
        }
      }
    }
  });
}