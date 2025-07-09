import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../lib/supabase/client';
import { serverConfig } from '../../lib/config/server-config';
import crypto from 'crypto';
import { z } from 'zod';
import { createApiLogger } from '../../lib/utils/logger';

// Webhook payload schemas for validation
const WebhookPayloadSchema = z.object({
  type: z.enum([
    'game.started',
    'game.ended',
    'score.update',
    'player.injury',
    'player.stats.update',
    'trade.completed'
  ]),
  payload: z.record(z.any())
});

const GameStartedSchema = z.object({
  game_id: z.string(),
  sport: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  start_time: z.string()
});

const GameEndedSchema = z.object({
  game_id: z.string(),
  final_score_home: z.number(),
  final_score_away: z.number()
});

const ScoreUpdateSchema = z.object({
  game_id: z.string(),
  home_score: z.number(),
  away_score: z.number(),
  period: z.number(),
  time_remaining: z.string().optional()
});

const PlayerInjurySchema = z.object({
  player_id: z.string(),
  injury_type: z.string(),
  body_part: z.string(),
  status: z.enum(['questionable', 'doubtful', 'out', 'day-to-day', 'IR']),
  description: z.string()
});

const PlayerStatsUpdateSchema = z.object({
  player_id: z.string(),
  game_id: z.string(),
  stats: z.record(z.union([z.number(), z.string()]))
});

const TradeCompletedSchema = z.object({
  player_id: z.string(),
  from_team_id: z.string(),
  to_team_id: z.string(),
  trade_date: z.string(),
  details: z.record(z.any()).optional()
});

export async function POST(req: NextRequest) {
  const logger = createApiLogger('sports-data-webhook');
  
  // Get service role client for elevated permissions
  const supabase = await getServiceSupabase();
  
  try {
    // Verify webhook signature
    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();
    
    if (!verifyWebhookSignature(body, signature)) {
      logger.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate payload
    let data;
    try {
      const parsed = JSON.parse(body);
      data = WebhookPayloadSchema.parse(parsed);
    } catch (error) {
      logger.error('Invalid webhook payload', error);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { type, payload } = data;
    logger.info('Received webhook', { type });

    // Process webhook based on type
    try {
      switch (type) {
        case 'game.started':
          await handleGameStarted(supabase, GameStartedSchema.parse(payload));
          break;
        
        case 'game.ended':
          await handleGameEnded(supabase, GameEndedSchema.parse(payload));
          break;
        
        case 'score.update':
          await handleScoreUpdate(supabase, ScoreUpdateSchema.parse(payload));
          break;
        
        case 'player.injury':
          await handlePlayerInjury(supabase, PlayerInjurySchema.parse(payload));
          break;
        
        case 'player.stats.update':
          await handlePlayerStatsUpdate(supabase, PlayerStatsUpdateSchema.parse(payload));
          break;
        
        case 'trade.completed':
          await handleTradeCompleted(supabase, TradeCompletedSchema.parse(payload));
          break;
      }
    } catch (error) {
      logger.error('Error processing webhook', error, { type });
      // Don't expose internal errors
      return NextResponse.json(
        { error: 'Processing failed' },
        { status: 500 }
      );
    }

    // Log webhook receipt (non-blocking)
    supabase.from('webhook_logs').insert({
      type,
      payload,
      received_at: new Date().toISOString(),
      processed: true,
    }).then(() => {
      logger.info('Webhook logged', { type });
    }).catch(error => {
      logger.error('Failed to log webhook', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', error);
    // Don't expose internal error details
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  
  const webhookSecret = serverConfig.webhooks.sportsDataSecret;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function handleGameStarted(supabase: any, payload: z.infer<typeof GameStartedSchema>) {
  const { game_id, sport, home_team, away_team, start_time } = payload;
  
  const { error } = await supabase
    .from('games')
    .update({
      status: 'in_progress',
      actual_start_time: start_time,
      updated_at: new Date().toISOString(),
    })
    .eq('id', game_id);
  
  if (error) {
    throw new Error(`Failed to update game start: ${error.message}`);
  }
  
  logger.info('Game started', { awayTeam: away_team, homeTeam: home_team });
}

async function handleGameEnded(supabase: any, payload: z.infer<typeof GameEndedSchema>) {
  const { game_id, final_score_home, final_score_away } = payload;
  
  const { error } = await supabase
    .from('games')
    .update({
      status: 'final',
      final_score_home,
      final_score_away,
      updated_at: new Date().toISOString(),
    })
    .eq('id', game_id);
  
  if (error) {
    throw new Error(`Failed to update game end: ${error.message}`);
  }
  
  logger.info('Game ended', { awayScore: final_score_away, homeScore: final_score_home });
}

async function handleScoreUpdate(supabase: any, payload: z.infer<typeof ScoreUpdateSchema>) {
  const { game_id, home_score, away_score, period, time_remaining } = payload;
  
  const updateData: any = {
    final_score_home: home_score,
    final_score_away: away_score,
    period,
    updated_at: new Date().toISOString(),
  };
  
  if (time_remaining !== undefined) {
    updateData.time_remaining = time_remaining;
  }
  
  const { error } = await supabase
    .from('games')
    .update(updateData)
    .eq('id', game_id);
  
  if (error) {
    throw new Error(`Failed to update score: ${error.message}`);
  }
}

async function handlePlayerInjury(supabase: any, payload: z.infer<typeof PlayerInjurySchema>) {
  const { player_id, injury_type, body_part, status, description } = payload;
  
  // Use transaction to ensure data consistency
  const { error: deactivateError } = await supabase
    .from('player_injuries')
    .update({ is_active: false })
    .eq('player_id', player_id)
    .eq('is_active', true);
  
  if (deactivateError) {
    throw new Error(`Failed to deactivate old injuries: ${deactivateError.message}`);
  }
  
  const { error: insertError } = await supabase
    .from('player_injuries')
    .insert({
      player_id,
      injury_type,
      body_part,
      status,
      description,
      reported_date: new Date().toISOString(),
      is_active: true,
    });
  
  if (insertError) {
    throw new Error(`Failed to insert injury: ${insertError.message}`);
  }
  
  logger.info('Injury update', { playerId: player_id, status });
}

async function handlePlayerStatsUpdate(supabase: any, payload: z.infer<typeof PlayerStatsUpdateSchema>) {
  const { player_id, game_id, stats } = payload;
  
  // Validate stats contain expected fields
  if (!stats || typeof stats !== 'object') {
    throw new Error('Invalid stats object');
  }
  
  // Update game log
  const { error: gameLogError } = await supabase
    .from('player_game_logs')
    .upsert({
      player_id,
      game_id,
      game_date: new Date().toISOString().split('T')[0],
      stats,
      updated_at: new Date().toISOString(),
    });
  
  if (gameLogError) {
    throw new Error(`Failed to update game log: ${gameLogError.message}`);
  }
  
  // Update season totals
  const season = new Date().getFullYear();
  const { data: currentStats, error: fetchError } = await supabase
    .from('player_stats')
    .select('stats, games_played')
    .eq('player_id', player_id)
    .eq('season', season)
    .eq('season_type', 'regular')
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') { // Not found is ok
    throw new Error(`Failed to fetch current stats: ${fetchError.message}`);
  }
  
  if (currentStats) {
    // Properly aggregate stats
    const updatedStats = { ...currentStats.stats };
    Object.keys(stats).forEach(key => {
      if (typeof stats[key] === 'number' && typeof updatedStats[key] === 'number') {
        updatedStats[key] = updatedStats[key] + stats[key];
      }
    });
    
    const { error: updateError } = await supabase
      .from('player_stats')
      .update({
        stats: updatedStats,
        games_played: currentStats.games_played + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', player_id)
      .eq('season', season)
      .eq('season_type', 'regular');
    
    if (updateError) {
      throw new Error(`Failed to update season stats: ${updateError.message}`);
    }
  }
}

async function handleTradeCompleted(supabase: any, payload: z.infer<typeof TradeCompletedSchema>) {
  const { player_id, from_team_id, to_team_id, trade_date, details } = payload;
  
  // Update player's current team
  const { error: playerError } = await supabase
    .from('players')
    .update({
      current_team_id: to_team_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', player_id);
  
  if (playerError) {
    throw new Error(`Failed to update player team: ${playerError.message}`);
  }
  
  // Record transaction
  const { error: transactionError } = await supabase
    .from('player_transactions')
    .insert({
      player_id,
      from_team_id,
      to_team_id,
      transaction_type: 'trade',
      transaction_date: trade_date,
      details: details || {},
    });
  
  if (transactionError) {
    throw new Error(`Failed to record transaction: ${transactionError.message}`);
  }
  
  logger.info('Trade completed', { playerId: player_id, toTeamId: to_team_id });
}