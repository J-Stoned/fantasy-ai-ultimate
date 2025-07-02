/**
 * Voice processing endpoint for Hey Fantasy assistant
 * Handles natural language commands for fantasy sports
 */

import { NextRequest, NextResponse } from 'next/server';
import { voiceAssistant } from '../../../../../../lib/voice/RealVoiceAssistant';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { supabase } from '../../../../../../lib/supabase/client';

// Initialize voice assistant on first use
let assistantInitialized = false;

// Voice command processing patterns
const COMMAND_PATTERNS = {
  START_SIT: /(?:who should i|should i) (?:start|sit|bench|play)\s+(.+?)(?:\s+or\s+(.+?))?/i,
  WAIVER: /(?:best|top|good) (?:waiver|free agent|pickup)\s*(?:wire)?\s*(.+)?/i,
  TRADE: /should i (?:trade|accept|reject)\s+(.+?)\s+for\s+(.+)/i,
  INJURY: /is\s+(.+?)\s+(?:injured|hurt|playing|out)/i,
  PROJECTION: /(?:projected|expected)\s+(?:points|score)\s+(?:for\s+)?(.+)/i,
  LINEUP: /(?:my|show|what's)\s+(?:lineup|team|roster)/i,
  SCORE: /(?:my|what's)\s+(?:score|points|total)/i,
};

export async function POST(request: NextRequest) {
  try {
    // Initialize voice assistant if needed
    if (!assistantInitialized) {
      await voiceAssistant.initialize();
      assistantInitialized = true;
    }
    
    const body = await request.json();
    
    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY && !process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Anthropic API key not configured',
          message: 'Please add your ANTHROPIC_API_KEY to .env.local'
        },
        { status: 500 }
      );
    }
    const userId = body.userId || 'anonymous';
    
    // Handle different input types
    let command;
    
    if (body.audio) {
      // Base64 audio data
      const audioBuffer = Buffer.from(body.audio, 'base64');
      const tempPath = join(tmpdir(), `audio_${Date.now()}.wav`);
      await writeFile(tempPath, audioBuffer);
      
      command = await voiceAssistant.processAudioFile(tempPath);
      
    } else if (body.transcript) {
      // Text input (for testing or fallback)
      command = await voiceAssistant.parseCommand(body.transcript);
      
    } else {
      return NextResponse.json(
        { error: 'Either audio or transcript is required' },
        { status: 400 }
      );
    }
    
    // Add user context
    command.entities.userId = userId;
    
    // Execute the command
    const response = await voiceAssistant.executeCommand(command);
    
    // Generate voice response
    let audioUrl = null;
    if (body.includeAudio !== false) {
      try {
        const audioPath = await voiceAssistant.generateVoiceResponse(response);
        // In production, upload to CDN and return URL
        // For now, return local path
        audioUrl = audioPath;
      } catch (error) {
        console.error('Voice generation failed:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      command: {
        text: command.text,
        intent: command.intent,
        confidence: command.confidence
      },
      response: {
        text: response.text,
        audioUrl,
        actions: response.actions,
        emotion: response.emotion
      }
    });
    
  } catch (error: any) {
    console.error('Voice processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process voice command', details: error.message },
      { status: 500 }
    );
  }
}

// Helper functions for different command types
async function getStartSitAdvice(player1?: string, player2?: string): Promise<string> {
  if (!player1) {
    return "I'd be happy to help with start/sit decisions! Please tell me which players you're deciding between.";
  }

  if (player2) {
    // Compare two players
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .or(`name.ilike.%${player1}%,name.ilike.%${player2}%`)
      .limit(2);

    if (players && players.length === 2) {
      const p1 = players.find(p => p.name.toLowerCase().includes(player1.toLowerCase()));
      const p2 = players.find(p => p.name.toLowerCase().includes(player2.toLowerCase()));
      
      if (p1 && p2) {
        const winner = p1.projected_points > p2.projected_points ? p1 : p2;
        const loser = winner === p1 ? p2 : p1;
        
        return `I'd start ${winner.name} over ${loser.name} this week. ${winner.name} is projected for ${winner.projected_points?.toFixed(1)} points compared to ${loser.name}'s ${loser.projected_points?.toFixed(1)} points. ${winner.name} has the better matchup and higher upside.`;
      }
    }
  }

  return `I recommend checking the matchups and recent performance for ${player1}. Consider factors like opponent defense ranking and weather conditions.`;
}

async function getWaiverSuggestions(position: string): Promise<string> {
  const positionUpper = position.toUpperCase();
  const validPositions = ['QB', 'RB', 'WR', 'TE'];
  
  const query = supabase
    .from('players')
    .select('*')
    .lt('ownership_percentage', 50) // Available on waivers
    .order('projected_points', { ascending: false })
    .limit(3);

  if (validPositions.includes(positionUpper)) {
    query.eq('position', positionUpper);
  }

  const { data: players } = await query;

  if (players && players.length > 0) {
    const suggestions = players.map(p => 
      `${p.name} (${p.position}) - ${p.projected_points?.toFixed(1)} pts`
    ).join(', ');
    
    return `Top waiver wire pickups${position !== 'all' ? ` for ${positionUpper}` : ''}: ${suggestions}. I especially like ${players[0].name} who's only ${players[0].ownership_percentage?.toFixed(0)}% owned but projected for ${players[0].projected_points?.toFixed(1)} points.`;
  }

  return `I'll help you find the best waiver wire pickups. Check players with low ownership but favorable upcoming matchups.`;
}

async function getTradeAdvice(player1?: string, player2?: string): Promise<string> {
  if (!player1 || !player2) {
    return "Tell me which players are involved in the trade and I'll analyze if it's a good deal for you.";
  }

  return `When evaluating a trade of ${player1} for ${player2}, consider: rest of season schedule, injury history, and your team needs. I'd also check recent trade values and expert rankings to ensure it's fair.`;
}

async function getInjuryStatus(player?: string): Promise<string> {
  if (!player) {
    return "Which player's injury status would you like me to check?";
  }

  // In production, this would check real injury data
  return `I'll check the latest injury report for ${player}. For the most up-to-date information, I recommend checking the official injury reports released on Wednesday and Friday, and monitoring pre-game inactives.`;
}

async function getPlayerProjection(player?: string): Promise<string> {
  if (!player) {
    return "Which player's projection would you like to know?";
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .ilike('name', `%${player}%`)
    .limit(1);

  if (players && players.length > 0) {
    const p = players[0];
    return `${p.name} is projected for ${p.projected_points?.toFixed(1)} fantasy points this week. This projection factors in matchup, recent performance, and our AI model's analysis. ${p.projected_points > 15 ? "That's a solid play!" : "You might want to consider other options if available."}`;
  }

  return `I don't have current projections for ${player}, but I'd estimate based on their recent averages and matchup difficulty.`;
}

function getHelpfulResponse(transcript: string): string {
  const lowerTranscript = transcript.toLowerCase();
  
  if (lowerTranscript.includes('hello') || lowerTranscript.includes('hi') || lowerTranscript.includes('hey')) {
    return "Hey there! I'm your Fantasy AI assistant. I can help with start/sit decisions, waiver wire pickups, trade advice, injury updates, and player projections. What would you like to know?";
  }
  
  if (lowerTranscript.includes('thank')) {
    return "You're welcome! Good luck with your matchup this week. Remember, I'm here whenever you need fantasy advice!";
  }
  
  if (lowerTranscript.includes('help')) {
    return "I can help you with: start/sit decisions (just ask 'Should I start X or Y?'), waiver wire suggestions ('Best waiver RBs'), trade analysis ('Should I trade X for Y?'), injury status ('Is X injured?'), and player projections ('Projected points for X'). What would you like to know?";
  }

  return "I can help with start/sit decisions, waiver pickups, trades, injuries, and projections. Try asking something like 'Who should I start this week?' or 'Best waiver wire RBs'.";
}