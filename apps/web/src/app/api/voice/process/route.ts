import { NextRequest, NextResponse } from 'next/server';
import { createMLService } from '@/lib/services/ml-service';
import { ElevenLabsVoiceService } from '@/lib/services/elevenlabs-service';
import { VoiceCommandProcessor } from '@/lib/services/voice-command-processor';
import { PlayerAnalysisService } from '@/lib/services/player-analysis-service';
import { LineupOptimizationService } from '@/lib/services/lineup-optimization-service';
import { pool } from '@/lib/db';
import { logger } from '../../../../lib/logging/logger';
import { geminiService } from '@/lib/services/ai/gemini-service';
import { playerDataService } from '@/lib/database/player-data-service';
import { gameStatsService } from '@/lib/database/game-stats-service';

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

    // 🧠 PROCESS VOICE COMMAND WITH ML INTELLIGENCE + GEMINI AI
    const commandAnalysis = await voiceProcessor.processCommand(finalTranscript, {
      userId,
      platform: context?.platform || 'web',
      fantasyContext: {
        teamId: context?.fantasyTeamId,
        leagueId: context?.leagueId,
        currentWeek: context?.week || getCurrentNFLWeek()
      }
    });

    // Enhance intent detection with Gemini AI if confidence is low
    if (commandAnalysis.confidence < 0.7) {
      try {
        const geminiIntent = await geminiService.analyzeIntent(finalTranscript, {
          sport: 'nfl',
          context: 'fantasy_football',
          week: context?.week || getCurrentNFLWeek()
        });
        
        if (geminiIntent.confidence > commandAnalysis.confidence) {
          commandAnalysis.intent = geminiIntent.intent;
          commandAnalysis.confidence = geminiIntent.confidence;
          commandAnalysis.entities = { ...commandAnalysis.entities, ...geminiIntent.entities };
        }
      } catch (error) {
        logger.warn('Gemini intent enhancement failed, using original analysis', { error });
      }
    }

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
          try {
            // 🔥 ELITE: Search for player in our REAL 1.57M game stats database!
            const searchResults = await playerDataService.searchPlayers({
              query: playerName,
              limit: 1
            });
            
            if (searchResults && searchResults.length > 0) {
              const realPlayer = searchResults[0];
              
              // Get detailed stats from our massive game logs database
              const [gameStats, playerTrends] = await Promise.all([
                gameStatsService.getPlayerGameLogs(realPlayer.id, {
                  limit: 10,
                  sortBy: 'game_date',
                  sortOrder: 'desc'
                }),
                playerDataService.getPlayerTrends(realPlayer.id)
              ]);
              
              // Build comprehensive analysis from REAL data
              const analysis = {
                player: {
                  name: realPlayer.name,
                  position: realPlayer.position,
                  team: realPlayer.team || 'FA',
                  rating: realPlayer.overall_rating
                },
                injuryStatus: realPlayer.injury_status || 'healthy',
                projectedPoints: playerTrends.projections.nextGame,
                seasonAverage: realPlayer.season_stats?.fantasy_points_avg || 0,
                recentForm: playerTrends.shortTerm.averagePoints,
                consistency: playerTrends.shortTerm.consistency,
                trend: playerTrends.shortTerm.direction,
                keyInsights: [
                  `Averaging ${Math.round(realPlayer.season_stats?.fantasy_points_avg || 0)} fantasy points per game`,
                  `Recent form: ${playerTrends.shortTerm.direction === 'up' ? '📈 Trending up' : playerTrends.shortTerm.direction === 'down' ? '📉 Trending down' : '➡️ Stable'}`,
                  `Consistency score: ${Math.round(playerTrends.shortTerm.consistency)}%`,
                  gameStats.data && gameStats.data.length > 0 ? 
                    `Last game: ${Math.round(gameStats.data[0].fantasy_points || 0)} points` : 
                    'No recent games'
                ],
                recommendation: playerTrends.shortTerm.direction === 'up' && playerTrends.shortTerm.consistency > 70 ?
                  'Strong start candidate' : 
                  playerTrends.shortTerm.direction === 'down' ? 
                  'Consider benching or trading' : 
                  'Solid option with moderate risk',
                chartData: {
                  recentGames: gameStats.data?.slice(0, 5).map(g => ({
                    date: g.game_date,
                    points: g.fantasy_points || 0,
                    opponent: g.opponent
                  })) || []
                }
              };
              
              // Use AI service for enhanced analysis
              const aiAnalysis = await playerAnalysis.analyzePlayer(playerName, {
                includeProjections: true,
                includeInjuryStatus: true,
                includeMatchupAnalysis: true,
                currentWeek: context?.week || getCurrentNFLWeek()
              });
              
              // Merge real data with AI insights
              analysis.keyInsights.push(...(aiAnalysis.keyInsights || []));
              
              responseText = formatPlayerAnalysisResponse(analysis);
              visualData = analysis.chartData;
              suggestions = [
                `Compare ${realPlayer.name} to similar ${realPlayer.position}s`,
                `Show ${realPlayer.name}'s last 5 games`,
                `Should I trade ${realPlayer.name}?`,
                `${realPlayer.name}'s matchup outlook`
              ];
              
              logger.info(`🔥 Voice Assistant analyzed ${realPlayer.name} using REAL data from 1.57M game stats!`);
            } else {
              // Fallback to AI-only analysis if player not found
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
          } catch (error) {
            logger.error('Error in real player analysis:', { error, playerName });
            // Fallback to original AI analysis
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
        
        try {
          // 🔥 ELITE: Get waiver recommendations enhanced with REAL player data!
          const [waiverRecommendations, topPerformers] = await Promise.all([
            mlService.getWaiverWireRecommendations({
              position,
              teamId: context?.fantasyTeamId,
              leagueId: context?.leagueId,
              currentWeek: context?.week || getCurrentNFLWeek(),
              maxRecommendations: 5
            }),
            // Get top available players from our real database
            playerDataService.searchPlayers({
              position,
              available: true,
              sortBy: 'points',
              limit: 10
            })
          ]);
          
          // Enhance recommendations with real player data
          if (waiverRecommendations.players && topPerformers.length > 0) {
            for (const rec of waiverRecommendations.players) {
              const realPlayer = topPerformers.find(p => 
                p.name.toLowerCase().includes(rec.name.toLowerCase()) ||
                rec.name.toLowerCase().includes(p.name.toLowerCase())
              );
              
              if (realPlayer) {
                // Enhance with real stats
                rec.seasonAverage = realPlayer.season_stats?.fantasy_points_avg || rec.projectedPoints;
                rec.recentGames = realPlayer.season_stats?.games_played || 0;
                rec.consistency = realPlayer.season_stats?.consistency_rating || 50;
                rec.actualOwnership = realPlayer.ownership?.percentage || rec.ownershipPercentage;
                
                logger.info(`🔥 Enhanced waiver recommendation for ${rec.name} with real data!`);
              }
            }
          }
          
          responseText = formatWaiverWireResponse(waiverRecommendations);
          visualData = waiverRecommendations.projectionsChart;
          suggestions = [
            `Show more ${position} options`,
            'What about players returning from injury?',
            'Should I use my #1 waiver priority?',
            `Top available ${position}s by recent performance`
          ];
        } catch (error) {
          logger.error('Error enhancing waiver recommendations:', { error });
          // Fallback to ML-only recommendations
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
        }
        break;

      case 'INJURY_UPDATE':
        const playerForInjury = commandAnalysis.entities.playerName;
        if (playerForInjury) {
          try {
            // 🔥 ELITE: Check real injury status from our database!
            const searchResults = await playerDataService.searchPlayers({
              query: playerForInjury,
              limit: 1
            });
            
            if (searchResults && searchResults.length > 0) {
              const realPlayer = searchResults[0];
              
              // Get recent game logs to check for missed games
              const gameStats = await gameStatsService.getPlayerGameLogs(realPlayer.id, {
                limit: 5,
                sortBy: 'game_date',
                sortOrder: 'desc'
              });
              
              // Check if player has missed recent games
              const gamesPlayed = realPlayer.season_stats?.games_played || 0;
              const expectedGames = getCurrentNFLWeek() - 1; // Approximate
              const missedGames = Math.max(0, expectedGames - gamesPlayed);
              
              const injuryStatus = {
                playerName: realPlayer.name,
                status: realPlayer.injury_status || 'Healthy',
                details: realPlayer.injury_notes || (missedGames > 0 ? 
                  `Has missed ${missedGames} games this season` : 
                  'No injury designation'),
                fantasyImpact: missedGames > 2 ? 'HIGH RISK - Extended absence' :
                              missedGames > 0 ? 'MODERATE RISK - Recent missed time' :
                              'LOW RISK - Playing regularly',
                expectedReturn: realPlayer.injury_status === 'OUT' ? 'Unknown' :
                               realPlayer.injury_status === 'QUESTIONABLE' ? 'Game-time decision' :
                               'Expected to play',
                recentPerformance: gameStats.data && gameStats.data.length > 0 ?
                  `Last game: ${Math.round(gameStats.data[0].fantasy_points || 0)} points` :
                  'No recent games'
              };
              
              // Also get ML injury analysis for additional context
              const mlInjuryStatus = await mlService.getInjuryStatus(playerForInjury);
              if (mlInjuryStatus.details) {
                injuryStatus.details += `. ${mlInjuryStatus.details}`;
              }
              
              responseText = formatInjuryStatusResponse(injuryStatus);
              suggestions = [
                `Who should I start instead of ${realPlayer.name}?`,
                `Best ${realPlayer.position} replacements`,
                'Show me all injury updates this week',
                `${realPlayer.name}'s injury history`
              ];
              
              logger.info(`🔥 Voice Assistant checked injury status for ${realPlayer.name} using real data!`);
            } else {
              // Fallback to ML-only analysis
              const injuryStatus = await mlService.getInjuryStatus(playerForInjury);
              responseText = formatInjuryStatusResponse(injuryStatus);
              suggestions = [
                `Who should I start instead of ${playerForInjury}?`,
                `Best waiver wire replacements for ${playerForInjury}`,
                'Show me all injury updates this week'
              ];
            }
          } catch (error) {
            logger.error('Error checking injury status:', { error, playerForInjury });
            // Fallback to ML-only analysis
            const injuryStatus = await mlService.getInjuryStatus(playerForInjury);
            responseText = formatInjuryStatusResponse(injuryStatus);
            suggestions = [
              `Who should I start instead of ${playerForInjury}?`,
              `Best waiver wire replacements for ${playerForInjury}`,
              'Show me all injury updates this week'
            ];
          }
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
        // 🤖 USE GEMINI AI FOR INTELLIGENT FANTASY ADVICE
        try {
          // First, try to get specific fantasy insights using Gemini
          const fantasyContext = {
            sport: 'nfl',
            week: context?.week || getCurrentNFLWeek(),
            fantasyTeamId: context?.fantasyTeamId,
            leagueId: context?.leagueId,
            playerData: await getRecentPlayerData(userId)
          };

          // Get AI-powered advice with context
          const geminiResponse = await geminiService.getLineupAdvice(
            finalTranscript,
            fantasyContext
          );

          responseText = geminiResponse.advice;
          visualData = geminiResponse.data;
          
          // If advice includes specific player recommendations, add actions
          if (geminiResponse.playerRecommendations) {
            actions = geminiResponse.playerRecommendations.map((rec: any) => ({
              type: 'player_recommendation',
              player: rec.name,
              action: rec.action,
              confidence: rec.confidence
            }));
          }

          // Generate contextual suggestions based on the advice
          suggestions = geminiResponse.followUpQuestions || [
            'Who should I start this week?',
            'Show me the best waiver wire pickups',
            'Optimize my lineup for this week'
          ];

        } catch (geminiError) {
          logger.error('Gemini AI processing error:', { error: geminiError });
          
          // Fallback to basic response
          responseText = "I'm having trouble accessing my advanced analytics right now. Try asking about specific players or lineup optimization.";
          suggestions = [
            'Who should I start this week?',
            'Show me the best waiver wire pickups',
            'Optimize my lineup for this week'
          ];
        }
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

async function getRecentPlayerData(userId: string): Promise<any> {
  try {
    // 🔥 ELITE: Get user's recent player interactions with REAL stats!
    const result = await pool.query(`
      SELECT DISTINCT p.id, p.name, p.position, p.team
      FROM player_interactions pi
      JOIN players p ON pi.player_id = p.id
      WHERE pi.user_id = $1
      ORDER BY pi.created_at DESC
      LIMIT 10
    `, [userId]);
    
    if (result.rows.length > 0) {
      // Enhance with real player data
      const enhancedPlayers = await Promise.all(
        result.rows.map(async (player) => {
          try {
            const { data } = await playerDataService.getPlayerById(player.id);
            if (data) {
              return {
                id: player.id,
                name: data.name,
                position: data.position,
                team: data.team || player.team,
                seasonAverage: data.season_stats?.fantasy_points_avg || 0,
                recentTrend: data.injury_status || 'healthy',
                gamesPlayed: data.season_stats?.games_played || 0
              };
            }
          } catch (e) {
            // Fallback to basic data
          }
          return player;
        })
      );
      
      logger.info(`🔥 Enhanced ${enhancedPlayers.length} recent players with real stats for voice context!`);
      return enhancedPlayers;
    }
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching recent player data:', { error });
    return [];
  }
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
  const seasonAvg = analysis.seasonAverage ? `Season average: ${analysis.seasonAverage.toFixed(1)} points. ` : '';
  const recentForm = analysis.recentForm ? `Recent form: ${analysis.recentForm.toFixed(1)} points over last 3 games. ` : '';
  const consistency = analysis.consistency ? `Consistency: ${Math.round(analysis.consistency)}%. ` : '';
  
  return `${player.name} (${player.position}${player.team ? ', ' + player.team : ''}) is currently ${analysis.injuryStatus || 'healthy'} and projected for ${analysis.projectedPoints.toFixed(1)} points this week. 
  
${seasonAvg}${recentForm}${consistency}
  
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
  const seasonAvg = topPick.seasonAverage ? `Season average: ${topPick.seasonAverage.toFixed(1)} points` : '';
  const consistency = topPick.consistency ? ` (${Math.round(topPick.consistency)}% consistent)` : '';
  const ownership = topPick.actualOwnership || topPick.ownershipPercentage;
  
  return `Best waiver wire pickup: ${topPick.name} (${topPick.position})

Projected: ${topPick.projectedPoints} points this week
${seasonAvg}${consistency}
Ownership: ${ownership}%
Priority level: ${topPick.priorityLevel}

Other options: ${recommendations.players.slice(1, 3).map((p: any) => p.name).join(', ')}`;
}

function formatInjuryStatusResponse(status: any): string {
  const recentPerf = status.recentPerformance ? `\n\n${status.recentPerformance}` : '';
  
  return `${status.playerName} injury status: ${status.status}

${status.details}

Fantasy impact: ${status.fantasyImpact}
Expected return: ${status.expectedReturn || 'Unknown'}${recentPerf}`;
}

function formatMatchupAnalysisResponse(analysis: any): string {
  return `This week's matchup looks ${analysis.outlook.toLowerCase()}!

Projected score: You ${analysis.yourProjection} - ${analysis.opponentProjection} Opponent

Key advantages: ${analysis.advantages.join(', ')}
Key risks: ${analysis.risks.join(', ')}

Win probability: ${analysis.winProbability}%`;
}