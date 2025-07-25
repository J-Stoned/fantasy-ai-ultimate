import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer } from 'ws';
import { realtimeServer } from '@/lib/services/websocket-server';
import { logger } from '../../../../lib/logging/logger';

// Draft-specific message handlers
interface DraftWebSocketMessage {
  type: string;
  data: any;
  draftId?: string;
  userId?: string;
  teamId?: string;
}

interface DraftState {
  draftId: string;
  participants: Map<string, DraftParticipant>;
  currentPick: number;
  currentRound: number;
  currentTeamId: string;
  pickTimer: number;
  isPaused: boolean;
  isCompleted: boolean;
  picks: DraftPick[];
  chatMessages: DraftChatMessage[];
}

interface DraftParticipant {
  userId: string;
  teamId: string;
  username: string;
  isOnline: boolean;
  isCurrentPick: boolean;
  autoPick: boolean;
  isCommissioner: boolean;
}

interface DraftPick {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  timestamp: Date;
  timeToMake?: number;
}

interface DraftChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  emoji?: string;
}

// In-memory draft states (in production, use Redis or database)
const draftStates = new Map<string, DraftState>();
const draftTimers = new Map<string, NodeJS.Timeout>();

class DraftWebSocketHandler {
  constructor() {
    this.setupDraftMessageHandlers();
  }

  private setupDraftMessageHandlers() {
    // Extend the existing WebSocket server with draft-specific handlers
    const originalHandleCustomMessage = (realtimeServer as any).handleCustomMessage;
    
    (realtimeServer as any).handleCustomMessage = (ws: any, message: DraftWebSocketMessage) => {
      switch (message.type) {
        case 'draft:join':
          this.handleJoinDraft(ws, message);
          break;
        case 'draft:make_pick':
          this.handleMakePick(ws, message);
          break;
        case 'draft:chat_send':
          this.handleChatMessage(ws, message);
          break;
        case 'draft:autopick_toggle':
          this.handleAutopickToggle(ws, message);
          break;
        case 'draft:pause':
          this.handlePauseDraft(ws, message);
          break;
        case 'draft:resume':
          this.handleResumeDraft(ws, message);
          break;
        case 'draft:skip_pick':
          this.handleSkipPick(ws, message);
          break;
        case 'draft:undo_pick':
          this.handleUndoPick(ws, message);
          break;
        default:
          // Fall back to original handler
          if (originalHandleCustomMessage) {
            originalHandleCustomMessage.call(realtimeServer, ws, message);
          }
      }
    };
  }

  private handleJoinDraft(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId, teamId } = message.data;
    
    // Get or create draft state
    let draftState = draftStates.get(draftId);
    if (!draftState) {
      draftState = this.createNewDraft(draftId);
      draftStates.set(draftId, draftState);
    }

    // Add/update participant
    const participant: DraftParticipant = {
      userId,
      teamId,
      username: `Player ${teamId.split('-')[1]}`,
      isOnline: true,
      isCurrentPick: draftState.currentTeamId === teamId,
      autoPick: false,
      isCommissioner: userId === 'commissioner'
    };

    draftState.participants.set(userId, participant);

    // Broadcast user joined
    this.broadcastToDraft(draftId, {
      type: 'draft:user_joined',
      data: {
        userId,
        username: participant.username,
        teamId
      }
    });

    // Send current state to joining user
    this.sendToDraftUser(draftId, userId, {
      type: 'draft:state_update',
      data: this.getDraftStateForClient(draftState)
    });

    // Broadcast updated participants
    this.broadcastParticipants(draftId);

    // Start draft timer if this is the first participant
    if (draftState.participants.size === 1) {
      this.startPickTimer(draftId);
    }
  }

  private handleMakePick(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId, teamId, playerId, playerName, position, team } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState || draftState.currentTeamId !== teamId) {
      this.sendToDraftUser(draftId, userId, {
        type: 'error',
        data: { message: 'Not your turn to pick' }
      });
      return;
    }

    // Create pick
    const pick: DraftPick = {
      pickNumber: draftState.currentPick,
      round: draftState.currentRound,
      teamId,
      playerId,
      playerName,
      position,
      team,
      timestamp: new Date()
    };

    // Add pick to draft state
    draftState.picks.push(pick);

    // Advance to next pick
    this.advanceToNextPick(draftState);

    // Broadcast pick made
    this.broadcastToDraft(draftId, {
      type: 'draft:pick_made',
      data: pick
    });

    // Broadcast updated state
    this.broadcastToDraft(draftId, {
      type: 'draft:state_update',
      data: this.getDraftStateForClient(draftState)
    });

    // Update participants
    this.broadcastParticipants(draftId);

    // Restart timer for next pick
    this.startPickTimer(draftId);
  }

  private handleChatMessage(ws: any, message: DraftWebSocketMessage) {
    const { draftId } = message;
    const chatData = message.data;

    const chatMessage: DraftChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      ...chatData,
      timestamp: new Date()
    };

    // Add to draft state
    const draftState = draftStates.get(draftId!);
    if (draftState) {
      draftState.chatMessages.push(chatMessage);
      
      // Keep only last 100 messages
      if (draftState.chatMessages.length > 100) {
        draftState.chatMessages = draftState.chatMessages.slice(-100);
      }
    }

    // Broadcast chat message
    this.broadcastToDraft(draftId!, {
      type: 'draft:chat_message',
      data: chatMessage
    });
  }

  private handleAutopickToggle(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId, teamId, enabled } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState) return;

    const participant = draftState.participants.get(userId);
    if (participant) {
      participant.autoPick = enabled;
      this.broadcastParticipants(draftId);
    }
  }

  private handlePauseDraft(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState) return;

    // Check if user is commissioner
    const participant = draftState.participants.get(userId);
    if (!participant?.isCommissioner) {
      this.sendToDraftUser(draftId, userId, {
        type: 'error',
        data: { message: 'Only commissioner can pause draft' }
      });
      return;
    }

    draftState.isPaused = true;
    this.clearPickTimer(draftId);

    this.broadcastToDraft(draftId, {
      type: 'draft:paused',
      data: { pausedBy: participant.username }
    });
  }

  private handleResumeDraft(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState) return;

    const participant = draftState.participants.get(userId);
    if (!participant?.isCommissioner) {
      this.sendToDraftUser(draftId, userId, {
        type: 'error',
        data: { message: 'Only commissioner can resume draft' }
      });
      return;
    }

    draftState.isPaused = false;
    this.startPickTimer(draftId);

    this.broadcastToDraft(draftId, {
      type: 'draft:resumed',
      data: { resumedBy: participant.username }
    });
  }

  private handleSkipPick(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId, teamId } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState || draftState.currentTeamId !== teamId) return;

    // Auto-pick the highest rated available player
    this.makeAutoPick(draftId, teamId);
  }

  private handleUndoPick(ws: any, message: DraftWebSocketMessage) {
    const { draftId, userId } = message.data;
    const draftState = draftStates.get(draftId);
    
    if (!draftState) return;

    const participant = draftState.participants.get(userId);
    if (!participant?.isCommissioner) {
      this.sendToDraftUser(draftId, userId, {
        type: 'error',
        data: { message: 'Only commissioner can undo picks' }
      });
      return;
    }

    if (draftState.picks.length === 0) return;

    // Remove last pick
    const lastPick = draftState.picks.pop();
    if (lastPick) {
      // Revert to previous pick state
      draftState.currentPick = lastPick.pickNumber;
      draftState.currentRound = lastPick.round;
      draftState.currentTeamId = lastPick.teamId;

      // Update participants
      draftState.participants.forEach(p => {
        p.isCurrentPick = p.teamId === draftState.currentTeamId;
      });

      // Broadcast undo
      this.broadcastToDraft(draftId, {
        type: 'draft:pick_undone',
        data: { pick: lastPick, undoneBy: participant.username }
      });

      // Broadcast updated state
      this.broadcastToDraft(draftId, {
        type: 'draft:state_update',
        data: this.getDraftStateForClient(draftState)
      });

      this.broadcastParticipants(draftId);
      this.startPickTimer(draftId);
    }
  }

  private createNewDraft(draftId: string): DraftState {
    return {
      draftId,
      participants: new Map(),
      currentPick: 1,
      currentRound: 1,
      currentTeamId: 'team-1',
      pickTimer: 120, // 2 minutes
      isPaused: false,
      isCompleted: false,
      picks: [],
      chatMessages: []
    };
  }

  private advanceToNextPick(draftState: DraftState) {
    const totalTeams = 12; // Configure based on league
    
    draftState.currentPick++;
    
    // Check if round is complete
    if (draftState.currentPick > draftState.currentRound * totalTeams) {
      draftState.currentRound++;
      
      // Snake draft logic - reverse order on even rounds
      if (draftState.currentRound % 2 === 0) {
        draftState.currentTeamId = `team-${totalTeams}`;
      } else {
        draftState.currentTeamId = 'team-1';
      }
    } else {
      // Calculate next team in snake pattern
      const pickInRound = ((draftState.currentPick - 1) % totalTeams) + 1;
      const isEvenRound = draftState.currentRound % 2 === 0;
      
      const teamNumber = isEvenRound 
        ? totalTeams - pickInRound + 1 
        : pickInRound;
      
      draftState.currentTeamId = `team-${teamNumber}`;
    }

    // Update participant current pick status
    draftState.participants.forEach(p => {
      p.isCurrentPick = p.teamId === draftState.currentTeamId;
    });

    // Check if draft is complete
    const totalPicks = totalTeams * 16; // 16 rounds
    if (draftState.currentPick > totalPicks) {
      draftState.isCompleted = true;
      this.clearPickTimer(draftState.draftId);
    }
  }

  private startPickTimer(draftId: string) {
    const draftState = draftStates.get(draftId);
    if (!draftState || draftState.isPaused || draftState.isCompleted) return;

    // Clear existing timer
    this.clearPickTimer(draftId);

    let timeRemaining = 120; // 2 minutes

    const timer = setInterval(() => {
      timeRemaining--;

      // Broadcast timer update
      this.broadcastToDraft(draftId, {
        type: 'draft:timer_update',
        data: {
          timeRemaining,
          currentTeamId: draftState.currentTeamId,
          pickNumber: draftState.currentPick,
          round: draftState.currentRound
        }
      });

      // Auto-pick when time expires
      if (timeRemaining <= 0) {
        this.makeAutoPick(draftId, draftState.currentTeamId);
        clearInterval(timer);
      }
    }, 1000);

    draftTimers.set(draftId, timer);
  }

  private clearPickTimer(draftId: string) {
    const timer = draftTimers.get(draftId);
    if (timer) {
      clearInterval(timer);
      draftTimers.delete(draftId);
    }
  }

  private makeAutoPick(draftId: string, teamId: string) {
    // Simulate auto-pick with best available player
    const mockPlayers = [
      { id: 'player-auto-1', name: 'Auto Pick RB', position: 'RB', team: 'KC' },
      { id: 'player-auto-2', name: 'Auto Pick WR', position: 'WR', team: 'BUF' },
      { id: 'player-auto-3', name: 'Auto Pick QB', position: 'QB', team: 'SF' }
    ];

    const randomPlayer = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];

    // Make the pick
    this.handleMakePick(null, {
      type: 'draft:make_pick',
      data: {
        draftId,
        userId: 'auto-pick',
        teamId,
        playerId: randomPlayer.id,
        playerName: randomPlayer.name,
        position: randomPlayer.position,
        team: randomPlayer.team
      }
    });

    // Broadcast timeout notification
    this.broadcastToDraft(draftId, {
      type: 'draft:pick_timeout',
      data: {
        teamId,
        teamName: `Team ${teamId.split('-')[1]}`,
        player: randomPlayer
      }
    });
  }

  private getDraftStateForClient(draftState: DraftState) {
    return {
      draftId: draftState.draftId,
      currentPick: draftState.currentPick,
      currentRound: draftState.currentRound,
      currentTeamId: draftState.currentTeamId,
      isPaused: draftState.isPaused,
      isCompleted: draftState.isCompleted,
      pickCount: draftState.picks.length,
      participants: Array.from(draftState.participants.values())
    };
  }

  private broadcastToDraft(draftId: string, message: any) {
    realtimeServer.publishToChannel(`draft:${draftId}:all`, message);
  }

  private broadcastParticipants(draftId: string) {
    const draftState = draftStates.get(draftId);
    if (!draftState) return;

    this.broadcastToDraft(draftId, {
      type: 'draft:participants_update',
      data: Array.from(draftState.participants.values())
    });
  }

  private sendToDraftUser(draftId: string, userId: string, message: any) {
    realtimeServer.sendToUserId(userId, message);
  }
}

// Initialize draft handler
const draftHandler = new DraftWebSocketHandler();

// API route for WebSocket upgrade
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Draft WebSocket service is running',
    status: 'active',
    endpoints: {
      websocket: 'ws://localhost:3001',
      channels: [
        'draft:{draftId}:picks',
        'draft:{draftId}:chat', 
        'draft:{draftId}:timer',
        'draft:{draftId}:state',
        'draft:{draftId}:participants'
      ]
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action, draftId, ...data } = await request.json();

    switch (action) {
      case 'create_draft':
        // Create new draft room
        const newDraftId = `draft_${Date.now()}`;
        const draftState = draftStates.get(newDraftId) || {
          draftId: newDraftId,
          participants: new Map(),
          currentPick: 1,
          currentRound: 1,
          currentTeamId: 'team-1',
          pickTimer: 120,
          isPaused: false,
          isCompleted: false,
          picks: [],
          chatMessages: []
        };
        
        draftStates.set(newDraftId, draftState);
        
        return NextResponse.json({
          success: true,
          draftId: newDraftId,
          websocketUrl: `ws://localhost:3001?token=${data.token || 'demo-token'}`
        });

      case 'get_draft_state':
        const draft = draftStates.get(draftId);
        if (!draft) {
          return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          state: {
            ...draft,
            participants: Array.from(draft.participants.values())
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Draft WebSocket API error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}