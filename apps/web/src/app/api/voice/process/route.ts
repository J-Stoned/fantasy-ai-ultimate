import { NextRequest, NextResponse } from 'next/server';
import { createMLService } from '@/lib/services/ml-service';
import { ElevenLabsVoiceService } from '@/lib/services/elevenlabs-service';
import { VoiceCommandProcessor } from '@/lib/services/voice-command-processor';
import { PlayerAnalysisService } from '@/lib/services/player-analysis-service';
import { LineupOptimizationService } from '@/lib/services/lineup-optimization-service';
import { pool } from '@/lib/db';
import { logger } from '../../../../lib/logging/logger';

// 🔥 ENTERPRISE VOICE PROCESSING API - ML + 11LABS INTEGRATION

interface VoiceProcessingRequest {
  audio?: string; // Base64 audio from mobile
  transcript?: string; // Direct text from web
  userId: string;
  context?: {
    platform?: 'web' | 'mobile';
    fantasyTeamId?: string;
    leagueId?: string;
    week?: number;
  };
  includeAudio?: boolean;
}

interface VoiceProcessingResponse {
  success: boolean;
  commandId: string;
  transcript: string;
  intent: string;
  confidence: number;
  response: {
    text: string;
    audioUrl?: string;
    visualData?: any;
    actions?: any[];
  };
  suggestions: string[];
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: VoiceProcessingRequest = await request.json();
    const { audio, transcript, userId, context, includeAudio = true } = body;

    // 🚀 INITIALIZE ENTERPRISE SERVICES
    const mlService = createMLService();
    const elevenLabsService = new ElevenLabsVoiceService({
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
      model: 'eleven_turbo_v2_5'
    });
    const voiceProcessor = new VoiceCommandProcessor();
    const playerAnalysis = new PlayerAnalysisService(mlService);
    const lineupOptimizer = new LineupOptimizationService(mlService);

    let finalTranscript = transcript;

    // 📹 PROCESS AUDIO IF PROVIDED (MOBILE)
    if (audio && !transcript) {
      try {
        // Convert base64 to audio buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        
        // Use OpenAI Whisper for speech-to-text
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
          body: createFormData(audioBuffer, 'audio.webm')
        });

        if (whisperResponse.ok) {
          const whisperData = await whisperResponse.json();
          finalTranscript = whisperData.text;
        } else {
          throw new Error('Speech-to-text failed');
        }
      } catch (error) {
        logger.error('Audio processing error:', { error: error });
        return NextResponse.json({
          success: false,
          error: 'Failed to process audio'
        }, { status: 500 });
      }
    }

    if (!finalTranscript) {
      return NextResponse.json({
        success: false,
        error: 'No transcript provided'
      }, { status: 400 });
    }

    // 🧠 PROCESS VOICE COMMAND WITH ML INTELLIGENCE
    const commandAnalysis = await voiceProcessor.processCommand(finalTranscript, {
      userId,
      platform: context?.platform || 'web',
      fantasyContext: {
        teamId: context?.fantasyTeamId,
        leagueId: context?.leagueId,
        currentWeek: context?.week || getCurrentNFLWeek()
      }
    });

    const commandId = generateCommandId();
    let responseText = '';
    let visualData: any = null;
    let actions: any[] = [];
    let suggestions: string[] = [];

    // 🎯 ROUTE TO APPROPRIATE ML SERVICE BASED ON INTENT
    switch (commandAnalysis.intent) {
      case 'PLAYER_ANALYSIS':
        const playerName = commandAnalysis.entities.playerName;
        if (playerName) {
          const analysis = await playerAnalysis.analyzePlayer(playerName, {
            includeProjections: true,
            includeInjuryStatus: true,
            includeMatchupAnalysis: true,
            currentWeek: context?.week || getCurrentNFLWeek()
          });
          
          responseText = formatPlayerAnalysisResponse(analysis);
          visualData = analysis.chartData;
          suggestions = [
            `Compare ${playerName} to similar players`,
            `Show ${playerName}'s weekly projections`,
            `Should I trade ${playerName}?`
          ];
        }
        break;

      case 'LINEUP_OPTIMIZATION':
        if (context?.fantasyTeamId) {
          const optimization = await lineupOptimizer.optimizeLineup(context.fantasyTeamId, {
            strategy: commandAnalysis.entities.strategy || 'balanced',
            constraints: commandAnalysis.entities.constraints || {},
            currentWeek: context?.week || getCurrentNFLWeek()
          });
          
          responseText = formatLineupOptimizationResponse(optimization);
          visualData = optimization.projectedPoints;
          actions = [{
            type: 'update_lineup',
            lineup: optimization.optimalLineup
          }];
          suggestions = [
            'Explain the optimization strategy',
            'Show alternative lineup options',
            'What if I bench my QB?'
          ];
        }
        break;

      case 'TRADE_ANALYSIS':
        const tradeDetails = commandAnalysis.entities.tradeDetails;
        if (tradeDetails) {
          const tradeAnalysis = await mlService.analyzeTrade({
            givePlayers: tradeDetails.givePlayers,
            receivePlayers: tradeDetails.receivePlayers,
            teamId: context?.fantasyTeamId,
            leagueSettings: await getLeagueSettings(context?.leagueId)
          });
          
          responseText = formatTradeAnalysisResponse(tradeAnalysis);
          visualData = tradeAnalysis.impactChart;
          suggestions = [
            'What about a different trade proposal?',
            'Show me other trade opportunities',
            'How does this affect my playoff chances?'
          ];
        }
        break;

      case 'WAIVER_WIRE':
        const position = commandAnalysis.entities.position;
        const waiverRecommendations = await mlService.getWaiverWireRecommendations({
          position,
          teamId: context?.fantasyTeamId,
          leagueId: context?.leagueId,
          currentWeek: context?.week || getCurrentNFLWeek(),
          maxRecommendations: 5
        });
        
        responseText = formatWaiverWireResponse(waiverRecommendations);
        visualData = waiverRecommendations.projectionsChart;
        suggestions = [
          `Show more ${position} options`,
          'What about players returning from injury?',
          'Should I use my #1 waiver priority?'
        ];
        break;

      case 'INJURY_UPDATE':
        const playerForInjury = commandAnalysis.entities.playerName;
        if (playerForInjury) {
          const injuryStatus = await mlService.getInjuryStatus(playerForInjury);
          responseText = formatInjuryStatusResponse(injuryStatus);
          suggestions = [
            `Who should I start instead of ${playerForInjury}?`,
            `Best waiver wire replacements for ${playerForInjury}`,
            'Show me all injury updates this week'
          ];
        }
        break;

      case 'MATCHUP_ANALYSIS':
        if (context?.fantasyTeamId) {
          const matchupAnalysis = await mlService.getMatchupAnalysis({
            teamId: context.fantasyTeamId,
            week: context?.week || getCurrentNFLWeek(),
            opponentTeamId: commandAnalysis.entities.opponentId
          });
          
          responseText = formatMatchupAnalysisResponse(matchupAnalysis);
          visualData = matchupAnalysis.projectionComparison;
          suggestions = [
            'What are my opponent\'s weaknesses?',
            'Should I stream a defense against them?',
            'Show me head-to-head history'
          ];
        }
        break;

      case 'GENERAL_ADVICE':
      default:
        // 🤖 FALLBACK TO GPT-4 FOR GENERAL FANTASY ADVICE
        const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'system',
                content: `You are Marcus "The Fixer" Rodriguez, a fantasy football expert. Provide helpful, confident advice. Current week: ${getCurrentNFLWeek()}`
              },
              {
                role: 'user',
                content: finalTranscript
              }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          responseText = gptData.choices[0].message.content;
        } else {
          responseText = "I couldn't process that request right now. Try asking about specific players or lineup optimization.";
        }

        suggestions = [
          'Who should I start this week?',
          'Show me the best waiver wire pickups',
          'Optimize my lineup for this week'
        ];
        break;
    }

    // 🎵 GENERATE AUDIO RESPONSE WITH 11LABS
    let audioUrl: string | undefined;
    if (includeAudio && responseText) {
      try {
        const audioBuffer = await elevenLabsService.synthesizeSpeech(responseText, {
          voice_settings: {
            stability: 0.8,
            similarity_boost: 0.9,
            style: 0.5,
            use_speaker_boost: true
          }
        });

        // Save audio to temporary storage (in production, use S3/CloudFront)
        const audioFilename = `voice_response_${commandId}.mp3`;
        const audioPath = `/tmp/${audioFilename}`;
        
        // In production, upload to S3 and return CDN URL
        audioUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/voice/audio/${audioFilename}`;
        
        // Store audio temporarily (implement proper storage)
        await saveAudioFile(audioPath, audioBuffer);

      } catch (audioError) {
        logger.error('11Labs audio generation error:', { error: audioError });
        // Continue without audio - don't fail the entire request
      }
    }

    // 📊 LOG COMMAND FOR ANALYTICS
    await logVoiceCommand({
      commandId,
      userId,
      transcript: finalTranscript,
      intent: commandAnalysis.intent,
      confidence: commandAnalysis.confidence,
      responseText,
      platform: context?.platform || 'web',
      processingTimeMs: Date.now() - startTime
    });

    // 🚀 RETURN COMPREHENSIVE RESPONSE
    const response: VoiceProcessingResponse = {
      success: true,
      commandId,
      transcript: finalTranscript,
      intent: commandAnalysis.intent,
      confidence: commandAnalysis.confidence,
      response: {
        text: responseText,
        audioUrl,
        visualData,
        actions
      },
      suggestions,
      processingTime: Date.now() - startTime
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Voice processing error:', { error: error });
    
    return NextResponse.json({
      success: false,
      error: 'Voice processing failed',
      processingTime: Date.now() - startTime
    }, { status: 500 });
  }
}

// 🛠️ HELPER FUNCTIONS

function createFormData(audioBuffer: Buffer, filename: string): FormData {
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');
  return formData;
}

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentNFLWeek(): number {
  const seasonStart = new Date('2024-09-05');
  const now = new Date();
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(1, weeksSinceStart + 1), 18);
}

async function getLeagueSettings(leagueId?: string) {
  if (!leagueId) return null;
  
  try {
    const result = await pool.query(
      'SELECT settings FROM leagues WHERE id = $1',
      [leagueId]
    );
    return result.rows[0]?.settings || null;
  } catch (error) {
    logger.error('Error fetching league settings:', { error: error });
    return null;
  }
}

async function saveAudioFile(path: string, buffer: Buffer): Promise<void> {
  // In production, implement proper storage (S3, etc.)
  // For now, this is a placeholder
  logger.info('Audio file would be saved to: ${path}');
}

async function logVoiceCommand(logData: any): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO voice_commands (
        command_id, user_id, transcript, intent, confidence, 
        response_text, platform, processing_time_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      logData.commandId,
      logData.userId,
      logData.transcript,
      logData.intent,
      logData.confidence,
      logData.responseText,
      logData.platform,
      logData.processingTimeMs
    ]);
  } catch (error) {
    logger.error('Error logging voice command:', { error: error });
  }
}

// 📝 RESPONSE FORMATTERS

function formatPlayerAnalysisResponse(analysis: any): string {
  const player = analysis.player;
  return `${player.name} is currently ${analysis.injuryStatus || 'healthy'} and projected for ${analysis.projectedPoints} points this week. 
  
Key insights: ${analysis.keyInsights.join('. ')}
  
Recommendation: ${analysis.recommendation}`;
}

function formatLineupOptimizationResponse(optimization: any): string {
  return `I've optimized your lineup! Projected to score ${optimization.projectedPoints} points this week.

Key changes: ${optimization.changes.map((c: any) => `${c.action} ${c.player}`).join(', ')}

This gives you a ${optimization.improvementPercentage}% better chance of winning.`;
}

function formatTradeAnalysisResponse(analysis: any): string {
  return `Trade Analysis: This trade ${analysis.recommendation.toLowerCase()}! 

You give: ${analysis.givePlayers.join(', ')}
You get: ${analysis.receivePlayers.join(', ')}

Impact: ${analysis.weeklyImpact > 0 ? '+' : ''}${analysis.weeklyImpact} points per week
Fair value rating: ${analysis.fairnessRating}/10

${analysis.reasoning}`;
}

function formatWaiverWireResponse(recommendations: any): string {
  const topPick = recommendations.players[0];
  return `Best waiver wire pickup: ${topPick.name} (${topPick.position})

Projected: ${topPick.projectedPoints} points this week
Ownership: ${topPick.ownershipPercentage}%
Priority level: ${topPick.priorityLevel}

Other options: ${recommendations.players.slice(1, 3).map((p: any) => p.name).join(', ')}`;
}

function formatInjuryStatusResponse(status: any): string {
  return `${status.playerName} injury status: ${status.status}

${status.details}

Fantasy impact: ${status.fantasyImpact}
Expected return: ${status.expectedReturn || 'Unknown'}`;
}

function formatMatchupAnalysisResponse(analysis: any): string {
  return `This week's matchup looks ${analysis.outlook.toLowerCase()}!

Projected score: You ${analysis.yourProjection} - ${analysis.opponentProjection} Opponent

Key advantages: ${analysis.advantages.join(', ')}
Key risks: ${analysis.risks.join(', ')}

Win probability: ${analysis.winProbability}%`;
}