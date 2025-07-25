import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

// Types
interface FantasyAlert {
  id: string;
  type: 'touchdown' | 'injury' | 'weather' | 'lineup' | 'milestone' | 'benched' | 'target_share' | 'red_zone' | 'breakout';
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  player: {
    id: string;
    name: string;
    team: string;
    position: string;
  };
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
  };
  message: string;
  impact: 'high' | 'medium' | 'low';
  fantasyPointsImpact: number;
  timestamp: string;
  userId?: string; // For personalized alerts
  isRead: boolean;
  metadata?: {
    statChange?: Record<string, number>;
    contextualInfo?: string;
    actionable?: boolean;
    urgency?: 'immediate' | 'normal' | 'low';
  };
}

interface AlertSubscription {
  userId: string;
  playerId?: string;
  team?: string;
  position?: string;
  sport?: string;
  alertTypes: string[];
  minimumImpact: 'high' | 'medium' | 'low';
  isActive: boolean;
}

// Mock alerts data
const mockAlerts: FantasyAlert[] = [
  {
    id: 'alert_1',
    type: 'touchdown',
    sport: 'NFL',
    player: {
      id: 'nfl_player_2',
      name: 'Patrick Mahomes',
      team: 'KC',
      position: 'QB'
    },
    game: {
      id: 'nfl_1',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      status: 'live'
    },
    message: 'Patrick Mahomes throws 45-yard touchdown pass to Tyreek Hill',
    impact: 'high',
    fantasyPointsImpact: 4.0,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    isRead: false,
    metadata: {
      statChange: { passingTouchdowns: 1, passingYards: 45 },
      contextualInfo: '3rd quarter, 8:42 remaining',
      actionable: false,
      urgency: 'immediate'
    }
  },
  {
    id: 'alert_2',
    type: 'injury',
    sport: 'NBA',
    player: {
      id: 'nba_player_2',
      name: 'Jayson Tatum',
      team: 'BOS',
      position: 'SF'
    },
    game: {
      id: 'nba_1',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Boston Celtics',
      status: 'live'
    },
    message: 'Jayson Tatum questionable to return with left ankle sprain',
    impact: 'high',
    fantasyPointsImpact: -5.0,
    timestamp: new Date(Date.now() - 300000).toISOString(),
    isRead: false,
    metadata: {
      contextualInfo: 'Occurred with 6:24 left in 4th quarter',
      actionable: true,
      urgency: 'immediate'
    }
  },
  {
    id: 'alert_3',
    type: 'milestone',
    sport: 'NBA',
    player: {
      id: 'nba_player_1',
      name: 'LeBron James',
      team: 'LAL',
      position: 'PF'
    },
    game: {
      id: 'nba_1',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Boston Celtics',
      status: 'live'
    },
    message: 'LeBron James records triple-double: 28 PTS, 9 REB, 8 AST',
    impact: 'medium',
    fantasyPointsImpact: 3.0,
    timestamp: new Date(Date.now() - 180000).toISOString(),
    isRead: false,
    metadata: {
      statChange: { points: 28, rebounds: 9, assists: 8 },
      contextualInfo: 'Triple-double bonus applied',
      actionable: false,
      urgency: 'normal'
    }
  },
  {
    id: 'alert_4',
    type: 'weather',
    sport: 'NFL',
    player: {
      id: 'nfl_player_1',
      name: 'Josh Allen',
      team: 'BUF',
      position: 'QB'
    },
    game: {
      id: 'nfl_1',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      status: 'live'
    },
    message: 'Wind speeds increasing to 15+ mph, may impact passing game',
    impact: 'medium',
    fantasyPointsImpact: -2.0,
    timestamp: new Date(Date.now() - 600000).toISOString(),
    isRead: true,
    metadata: {
      contextualInfo: 'Crosswinds at Arrowhead Stadium',
      actionable: true,
      urgency: 'normal'
    }
  },
  {
    id: 'alert_5',
    type: 'red_zone',
    sport: 'NFL',
    player: {
      id: 'nfl_player_3',
      name: 'Travis Kelce',
      team: 'KC',
      position: 'TE'
    },
    game: {
      id: 'nfl_1',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      status: 'live'
    },
    message: 'Travis Kelce has 5+ targets in the red zone, high TD probability',
    impact: 'medium',
    fantasyPointsImpact: 2.5,
    timestamp: new Date(Date.now() - 420000).toISOString(),
    isRead: false,
    metadata: {
      statChange: { redZoneTargets: 5 },
      contextualInfo: 'Chiefs in red zone, 1st & goal',
      actionable: true,
      urgency: 'immediate'
    }
  }
];

// Mock subscriptions
const mockSubscriptions: AlertSubscription[] = [
  {
    userId: 'user123',
    playerId: 'nfl_player_1',
    alertTypes: ['touchdown', 'injury', 'milestone'],
    minimumImpact: 'medium',
    isActive: true
  },
  {
    userId: 'user123',
    team: 'KC',
    alertTypes: ['touchdown', 'injury'],
    minimumImpact: 'high',
    isActive: true
  }
];

// Simulate new alerts
const generateRandomAlert = () => {
  const alertTypes = ['touchdown', 'injury', 'milestone', 'red_zone', 'target_share'];
  const players = [
    { id: 'nfl_player_1', name: 'Josh Allen', team: 'BUF', position: 'QB' },
    { id: 'nfl_player_2', name: 'Patrick Mahomes', team: 'KC', position: 'QB' },
    { id: 'nfl_player_3', name: 'Travis Kelce', team: 'KC', position: 'TE' }
  ];

  const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
  const player = players[Math.floor(Math.random() * players.length)];
  
  let message = '';
  let impact: 'high' | 'medium' | 'low' = 'medium';
  let fantasyPointsImpact = 0;

  switch (alertType) {
    case 'touchdown':
      message = `${player.name} ${player.position === 'QB' ? 'throws' : 'scores'} ${Math.floor(Math.random() * 30) + 5}-yard touchdown`;
      impact = 'high';
      fantasyPointsImpact = player.position === 'QB' ? 4 : 6;
      break;
    case 'injury':
      message = `${player.name} questionable to return with injury`;
      impact = 'high';
      fantasyPointsImpact = -3;
      break;
    case 'milestone':
      message = `${player.name} reaches 100+ yards ${player.position === 'QB' ? 'passing' : 'receiving'}`;
      impact = 'medium';
      fantasyPointsImpact = 2;
      break;
    case 'red_zone':
      message = `${player.name} has multiple red zone opportunities`;
      impact = 'medium';
      fantasyPointsImpact = 1.5;
      break;
    case 'target_share':
      message = `${player.name} seeing increased target share this drive`;
      impact = 'low';
      fantasyPointsImpact = 1;
      break;
  }

  const newAlert: FantasyAlert = {
    id: `alert_${Date.now()}`,
    type: alertType as any,
    sport: 'NFL',
    player,
    game: {
      id: 'nfl_1',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      status: 'live'
    },
    message,
    impact,
    fantasyPointsImpact,
    timestamp: new Date().toISOString(),
    isRead: false,
    metadata: {
      contextualInfo: `Generated at ${new Date().toLocaleTimeString()}`,
      actionable: alertType === 'injury' || alertType === 'red_zone',
      urgency: impact === 'high' ? 'immediate' : 'normal'
    }
  };

  mockAlerts.unshift(newAlert);
  
  // Keep only last 50 alerts
  if (mockAlerts.length > 50) {
    mockAlerts.pop();
  }

  return newAlert;
};

// Generate alerts periodically
setInterval(() => {
  if (Math.random() > 0.7) { // 30% chance every interval
    generateRandomAlert();
  }
}, 45000); // Every 45 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sport = searchParams.get('sport');
    const playerId = searchParams.get('playerId');
    const team = searchParams.get('team');
    const alertType = searchParams.get('type');
    const impact = searchParams.get('impact');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const since = searchParams.get('since'); // ISO timestamp

    // Filter alerts based on query parameters
    let filteredAlerts = [...mockAlerts];

    if (sport) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.sport.toLowerCase() === sport.toLowerCase()
      );
    }

    if (playerId) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.player.id === playerId
      );
    }

    if (team) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.player.team.toLowerCase() === team.toLowerCase()
      );
    }

    if (alertType) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.type === alertType
      );
    }

    if (impact) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.impact === impact
      );
    }

    if (unreadOnly) {
      filteredAlerts = filteredAlerts.filter(alert => !alert.isRead);
    }

    if (since) {
      const sinceDate = new Date(since);
      filteredAlerts = filteredAlerts.filter(alert => 
        new Date(alert.timestamp) > sinceDate
      );
    }

    // Apply user-specific filters if userId provided
    if (userId) {
      const userSubscriptions = mockSubscriptions.filter(sub => 
        sub.userId === userId && sub.isActive
      );
      
      if (userSubscriptions.length > 0) {
        filteredAlerts = filteredAlerts.filter(alert => {
          return userSubscriptions.some(sub => {
            // Check if alert matches subscription criteria
            const matchesPlayer = !sub.playerId || alert.player.id === sub.playerId;
            const matchesTeam = !sub.team || alert.player.team === sub.team;
            const matchesPosition = !sub.position || alert.player.position === sub.position;
            const matchesSport = !sub.sport || alert.sport === sub.sport;
            const matchesType = sub.alertTypes.includes(alert.type);
            const matchesImpact = getImpactLevel(alert.impact) >= getImpactLevel(sub.minimumImpact);

            return matchesPlayer && matchesTeam && matchesPosition && matchesSport && matchesType && matchesImpact;
          });
        });
      }
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const paginatedAlerts = filteredAlerts.slice(0, limit);

    // Add summary statistics
    const summary = {
      total: filteredAlerts.length,
      unread: filteredAlerts.filter(a => !a.isRead).length,
      byImpact: {
        high: filteredAlerts.filter(a => a.impact === 'high').length,
        medium: filteredAlerts.filter(a => a.impact === 'medium').length,
        low: filteredAlerts.filter(a => a.impact === 'low').length
      },
      byType: filteredAlerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      success: true,
      data: paginatedAlerts,
      meta: {
        summary,
        filters: { userId, sport, playerId, team, alertType, impact, unreadOnly, limit, since },
        lastUpdate: new Date().toISOString(),
        hasMore: filteredAlerts.length > limit
      }
    });

  } catch (error) {
    logger.error('Fantasy alerts API error:', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fantasy alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId, data } = body;

    switch (action) {
      case 'markRead':
        return handleMarkRead(alertId);
      case 'markAllRead':
        return handleMarkAllRead(data.userId);
      case 'createAlert':
        return handleCreateAlert(data);
      case 'updateSubscription':
        return handleUpdateSubscription(data);
      case 'deleteAlert':
        return handleDeleteAlert(alertId);
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Fantasy alerts POST error:', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getImpactLevel(impact: string): number {
  switch (impact) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

async function handleMarkRead(alertId: string) {
  const alert = mockAlerts.find(a => a.id === alertId);
  if (!alert) {
    return NextResponse.json(
      { success: false, error: 'Alert not found' },
      { status: 404 }
    );
  }

  alert.isRead = true;

  return NextResponse.json({
    success: true,
    data: alert,
    message: 'Alert marked as read'
  });
}

async function handleMarkAllRead(userId: string) {
  let markedCount = 0;
  
  mockAlerts.forEach(alert => {
    if (!alert.isRead && (!alert.userId || alert.userId === userId)) {
      alert.isRead = true;
      markedCount++;
    }
  });

  return NextResponse.json({
    success: true,
    data: { markedCount },
    message: `${markedCount} alerts marked as read`
  });
}

async function handleCreateAlert(data: FantasyAlert) {
  const newAlert: FantasyAlert = {
    id: `alert_${Date.now()}`,
    ...data,
    timestamp: new Date().toISOString(),
    isRead: false
  };

  mockAlerts.unshift(newAlert);

  // Broadcast via WebSocket if available
  // realtimeServer.publishToChannel(`player-alerts/${data.userId || 'global'}`, {
  //   type: 'fantasy:alert',
  //   data: newAlert
  // });

  return NextResponse.json({
    success: true,
    data: newAlert,
    message: 'Alert created successfully'
  });
}

async function handleUpdateSubscription(data: AlertSubscription) {
  const existingIndex = mockSubscriptions.findIndex(sub => 
    sub.userId === data.userId && 
    sub.playerId === data.playerId &&
    sub.team === data.team
  );

  if (existingIndex >= 0) {
    mockSubscriptions[existingIndex] = data;
  } else {
    mockSubscriptions.push(data);
  }

  return NextResponse.json({
    success: true,
    data,
    message: 'Subscription updated successfully'
  });
}

async function handleDeleteAlert(alertId: string) {
  const alertIndex = mockAlerts.findIndex(a => a.id === alertId);
  if (alertIndex === -1) {
    return NextResponse.json(
      { success: false, error: 'Alert not found' },
      { status: 404 }
    );
  }

  const deletedAlert = mockAlerts.splice(alertIndex, 1)[0];

  return NextResponse.json({
    success: true,
    data: deletedAlert,
    message: 'Alert deleted successfully'
  });
}