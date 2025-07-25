import { NextRequest, NextResponse } from 'next/server';
import { realtimeServer } from '@/lib/services/websocket-server';
import { logger } from '../../../../lib/logging/logger';

interface ChatMessage {
  id: string;
  draftId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  emoji?: string;
  type?: 'message' | 'system' | 'pick_notification';
}

// In-memory chat storage (in production, use database)
const draftChats = new Map<string, ChatMessage[]>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID required' }, { status: 400 });
    }

    const messages = draftChats.get(draftId) || [];
    const paginatedMessages = messages
      .slice(-limit - offset, messages.length - offset)
      .reverse();

    return NextResponse.json({
      success: true,
      messages: paginatedMessages,
      total: messages.length,
      hasMore: messages.length > limit + offset
    });
  } catch (error) {
    logger.error('Get chat messages error:', { error: error });
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, userId, username, message, emoji, type = 'message' } = body;

    if (!draftId || !userId || !message) {
      return NextResponse.json({ 
        error: 'Draft ID, user ID, and message are required' 
      }, { status: 400 });
    }

    // Validate message length
    if (message.length > 500) {
      return NextResponse.json({ 
        error: 'Message too long (max 500 characters)' 
      }, { status: 400 });
    }

    // Create chat message
    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      draftId,
      userId,
      username: username || `User ${userId}`,
      message: message.trim(),
      timestamp: new Date(),
      emoji,
      type
    };

    // Store message
    if (!draftChats.has(draftId)) {
      draftChats.set(draftId, []);
    }
    
    const messages = draftChats.get(draftId)!;
    messages.push(chatMessage);
    
    // Keep only last 200 messages per draft
    if (messages.length > 200) {
      draftChats.set(draftId, messages.slice(-200));
    }

    // Broadcast message via WebSocket
    realtimeServer.publishToChannel(`draft:${draftId}:chat`, {
      type: 'draft:chat_message',
      data: chatMessage
    });

    // Also broadcast to general draft channel
    realtimeServer.publishToChannel(`draft:${draftId}:all`, {
      type: 'draft:chat_message',
      data: chatMessage
    });

    return NextResponse.json({
      success: true,
      message: chatMessage
    });
  } catch (error) {
    logger.error('Send chat message error:', { error: error });
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const messageId = searchParams.get('messageId');
    const userId = searchParams.get('userId');

    if (!draftId || !messageId || !userId) {
      return NextResponse.json({ 
        error: 'Draft ID, message ID, and user ID are required' 
      }, { status: 400 });
    }

    const messages = draftChats.get(draftId);
    if (!messages) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const message = messages[messageIndex];
    
    // Only allow user to delete their own messages or commissioner to delete any
    if (message.userId !== userId && !await isCommissioner(draftId, userId)) {
      return NextResponse.json({ 
        error: 'Not authorized to delete this message' 
      }, { status: 403 });
    }

    // Remove message
    messages.splice(messageIndex, 1);

    // Broadcast message deletion
    realtimeServer.publishToChannel(`draft:${draftId}:chat`, {
      type: 'draft:message_deleted',
      data: { messageId, deletedBy: userId }
    });

    return NextResponse.json({
      success: true,
      messageId
    });
  } catch (error) {
    logger.error('Delete chat message error:', { error: error });
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}

// System message helpers
export async function sendSystemMessage(
  draftId: string, 
  message: string, 
  type: 'system' | 'pick_notification' = 'system'
) {
  const systemMessage: ChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    draftId,
    userId: 'system',
    username: 'System',
    message,
    timestamp: new Date(),
    type
  };

  // Store message
  if (!draftChats.has(draftId)) {
    draftChats.set(draftId, []);
  }
  
  draftChats.get(draftId)!.push(systemMessage);

  // Broadcast system message
  realtimeServer.publishToChannel(`draft:${draftId}:chat`, {
    type: 'draft:chat_message',
    data: systemMessage
  });
}

export async function sendPickNotification(
  draftId: string,
  teamName: string,
  playerName: string,
  position: string,
  round: number,
  pick: number
) {
  const message = `${teamName} selects ${playerName} (${position}) with pick ${pick} in round ${round}`;
  
  await sendSystemMessage(draftId, message, 'pick_notification');
}

// Helper function to check if user is commissioner
async function isCommissioner(draftId: string, userId: string): Promise<boolean> {
  // In a real app, check database for commissioner status
  // For now, assume 'commissioner' userId is the commissioner
  return userId === 'commissioner';
}

// Utility functions for chat moderation
export async function moderateMessage(message: string): Promise<{ 
  isAllowed: boolean; 
  filteredMessage?: string; 
  reason?: string 
}> {
  // Basic profanity filter and spam detection
  const bannedWords = ['spam', 'bot', 'cheat']; // Extend as needed
  const lowerMessage = message.toLowerCase();
  
  for (const word of bannedWords) {
    if (lowerMessage.includes(word)) {
      return {
        isAllowed: false,
        reason: 'Message contains inappropriate content'
      };
    }
  }

  // Check for repeated characters (spam)
  if (/(.)\1{10,}/.test(message)) {
    return {
      isAllowed: false,
      reason: 'Message appears to be spam'
    };
  }

  // Check for excessive caps
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.8 && message.length > 10) {
    return {
      isAllowed: true,
      filteredMessage: message.toLowerCase()
    };
  }

  return { isAllowed: true };
}

// Rate limiting helper
const userMessageCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userStats = userMessageCounts.get(userId);
  
  if (!userStats || now > userStats.resetTime) {
    // Reset or initialize
    userMessageCounts.set(userId, {
      count: 1,
      resetTime: now + 60000 // Reset every minute
    });
    return true;
  }
  
  if (userStats.count >= 10) { // Max 10 messages per minute
    return false;
  }
  
  userStats.count++;
  return true;
}