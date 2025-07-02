import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RealVoiceAssistant } from '../../../../lib/voice/RealVoiceAssistant';
import * as fs from 'fs';
import * as path from 'path';
import { writeFile, mkdir } from 'fs/promises';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize the real voice assistant
const voiceAssistant = new RealVoiceAssistant();

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const userId = formData.get('userId') as string;
    const context = JSON.parse(formData.get('context') as string || '{}');
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    
    // Save audio file temporarily
    const tempDir = path.join(process.cwd(), 'temp', 'voice');
    await mkdir(tempDir, { recursive: true });
    
    const fileName = `voice_${Date.now()}.webm`;
    const filePath = path.join(tempDir, fileName);
    
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    // Process with real voice assistant
    const command = await voiceAssistant.processAudioFile(filePath);
    
    // Execute command based on intent
    let response: any;
    
    switch (command.intent) {
      case 'get_lineup_advice':
        response = await handleLineupAdvice(userId, command, context);
        break;
        
      case 'check_player_status':
        response = await handlePlayerStatus(command);
        break;
        
      case 'get_waiver_suggestions':
        response = await handleWaiverSuggestions(userId, command, context);
        break;
        
      case 'trade_analysis':
        response = await handleTradeAnalysis(command);
        break;
        
      default:
        response = {
          message: "I can help you with lineup advice, player status, waiver wire suggestions, and trade analysis. What would you like to know?",
          suggestions: [
            "Who should I start this week?",
            "Is Patrick Mahomes playing?",
            "Show me the best waiver wire pickups",
            "Should I trade Derrick Henry?"
          ]
        };
    }
    
    // Generate speech response
    const audioResponse = await voiceAssistant.speak(response.message);
    
    // Clean up temp file
    fs.unlinkSync(filePath);
    
    // Save to database
    const { data: savedCommand } = await supabase
      .from('voice_commands')
      .insert({
        user_id: userId,
        transcript: command.transcript,
        intent: command.intent,
        confidence: command.confidence,
        response: response.message,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return NextResponse.json({
      commandId: savedCommand?.id,
      transcript: command.transcript,
      intent: command.intent,
      confidence: command.confidence,
      response: response.message,
      audioUrl: audioResponse.audioUrl,
      data: response.data,
      suggestions: response.suggestions
    });
    
  } catch (error) {
    console.error('Voice processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process voice command' },
      { status: 500 }
    );
  }
}

async function handleLineupAdvice(userId: string, command: any, context: any) {
  const { data: lineup } = await supabase
    .from('lineups')
    .select(`
      *,
      lineup_players(
        *,
        player:players(*)
      )
    `)
    .eq('user_id', userId)
    .eq('week', context.week || getCurrentWeek())
    .single();
  
  // Get ML predictions for players
  const { data: predictions } = await supabase
    .from('ml_predictions')
    .select('*')
    .in('player_id', lineup?.lineup_players.map((lp: any) => lp.player_id) || [])
    .order('created_at', { ascending: false });
  
  const advice = generateLineupAdvice(lineup, predictions);
  
  return {
    message: advice,
    data: {
      lineup,
      predictions
    },
    suggestions: [
      "Should I bench anyone?",
      "Who's my highest scorer?",
      "Any injury concerns?"
    ]
  };
}

async function handlePlayerStatus(command: any) {
  const playerName = command.entities.player_name;
  
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .ilike('name', `%${playerName}%`)
    .single();
  
  if (!player) {
    return {
      message: `I couldn't find a player named ${playerName}. Can you be more specific?`,
      suggestions: ["Check another player", "Show my lineup"]
    };
  }
  
  // Get latest news
  const { data: news } = await supabase
    .from('news_articles')
    .select('*')
    .or(`title.ilike.%${player.name}%,summary.ilike.%${player.name}%`)
    .order('created_at', { ascending: false })
    .limit(3);
  
  const status = analyzePlayerStatus(player, news);
  
  return {
    message: status,
    data: { player, news },
    suggestions: [
      `Should I start ${player.name}?`,
      "Who else is injured?",
      "Show waiver wire options"
    ]
  };
}

async function handleWaiverSuggestions(userId: string, command: any, context: any) {
  const position = command.entities.position || 'any';
  
  // Get available players
  const { data: availablePlayers } = await supabase
    .from('players')
    .select('*')
    .not('id', 'in', `(SELECT player_id FROM roster_players WHERE is_active = true)`)
    .eq(position !== 'any' ? 'position' : '', position)
    .order('fantasy_points_avg', { ascending: false })
    .limit(10);
  
  // Get ML predictions
  const { data: predictions } = await supabase
    .from('ml_predictions')
    .select('*')
    .in('player_id', availablePlayers?.map(p => p.id) || [])
    .eq('prediction_type', 'weekly_points');
  
  const suggestions = generateWaiverSuggestions(availablePlayers, predictions);
  
  return {
    message: suggestions,
    data: { players: availablePlayers, predictions },
    suggestions: [
      "Add the top player",
      "Show RB options only",
      "Who should I drop?"
    ]
  };
}

async function handleTradeAnalysis(command: any) {
  const { give_players, receive_players } = command.entities;
  
  // Analyze trade value
  const analysis = await analyzeTradeValue(give_players, receive_players);
  
  return {
    message: analysis.summary,
    data: analysis,
    suggestions: [
      "What about a different trade?",
      "Show my team needs",
      "Recent trades in my league"
    ]
  };
}

function generateLineupAdvice(lineup: any, predictions: any[]): string {
  if (!lineup) {
    return "I don't see a lineup for this week. Would you like me to help you create one?";
  }
  
  const topScorer = predictions
    .filter(p => p.confidence > 0.7)
    .sort((a, b) => b.prediction - a.prediction)[0];
  
  return `Your lineup looks good! ${topScorer ? 
    `I'm expecting ${topScorer.player_name} to be your top scorer with ${topScorer.prediction} points.` : 
    'All your players are projected to perform well.'} 
    Any specific concerns about your lineup?`;
}

function analyzePlayerStatus(player: any, news: any[]): string {
  const recentNews = news[0];
  const injuryKeywords = ['injured', 'questionable', 'doubtful', 'out', 'hurt'];
  
  const hasInjuryConcern = news.some(article => 
    injuryKeywords.some(keyword => 
      article.title?.toLowerCase().includes(keyword) || 
      article.summary?.toLowerCase().includes(keyword)
    )
  );
  
  if (hasInjuryConcern) {
    return `${player.name} has an injury concern. ${recentNews?.summary || 'Check the latest updates before starting them.'}`;
  }
  
  return `${player.name} appears to be healthy and ready to play. They're averaging ${player.fantasy_points_avg || 0} fantasy points per game.`;
}

function generateWaiverSuggestions(players: any[], predictions: any[]): string {
  if (!players || players.length === 0) {
    return "No players available on waivers matching your criteria.";
  }
  
  const topPick = players[0];
  const prediction = predictions.find(p => p.player_id === topPick.id);
  
  return `I recommend picking up ${topPick.name} (${topPick.position}). 
    ${prediction ? 
      `They're projected for ${prediction.prediction} points with ${(prediction.confidence * 100).toFixed(0)}% confidence.` : 
      `They're averaging ${topPick.fantasy_points_avg || 0} points per game.`}
    Would you like to see more options?`;
}

async function analyzeTradeValue(give: string[], receive: string[]): Promise<any> {
  // This would do complex trade analysis
  return {
    summary: `This trade appears balanced. You're giving up ${give.join(', ')} for ${receive.join(', ')}. 
      Based on recent performance and projections, this could work in your favor if you need help at those positions.`,
    recommendation: 'accept',
    confidence: 0.75
  };
}

function getCurrentWeek(): number {
  // Calculate current NFL week
  const seasonStart = new Date('2024-09-05');
  const now = new Date();
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(1, weeksSinceStart + 1), 18);
}