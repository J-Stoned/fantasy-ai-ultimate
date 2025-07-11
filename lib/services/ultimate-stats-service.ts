import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { WebSocketBroadcaster } from '../streaming/websocket-broadcaster';

// Ultimate Stats Service - Real-time data pipeline for 45K+ logs with advanced metrics
export class UltimateStatsService {
  private supabase;
  private redis;
  private broadcaster: WebSocketBroadcaster;
  private updateInterval: number = 120000; // 2 minutes default
  private liveGameInterval: number = 30000; // 30 seconds for live games
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    
    this.broadcaster = new WebSocketBroadcaster();
  }

  // Main update pipeline - processes new stats and broadcasts changes
  async processLatestStats(sport?: string) {
    console.log(`🚀 Processing latest stats for ${sport || 'all sports'}...`);
    
    try {
      // 1. Get recent games that need updates
      const recentGames = await this.getRecentGames(sport);
      console.log(`Found ${recentGames.length} games to process`);
      
      // 2. Separate live vs completed games for different update frequencies
      const liveGames = recentGames.filter(g => g.status === 'in_progress');
      const completedGames = recentGames.filter(g => g.status === 'completed');
      
      // 3. Process games in parallel batches
      const batchSize = 10;
      const results = [];
      
      // Process live games first (higher priority)
      for (let i = 0; i < liveGames.length; i += batchSize) {
        const batch = liveGames.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(game => this.processGame(game))
        );
        results.push(...batchResults);
      }
      
      // Then process completed games
      for (let i = 0; i < completedGames.length; i += batchSize) {
        const batch = completedGames.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(game => this.processGame(game))
        );
        results.push(...batchResults);
      }
      
      // 4. Broadcast summary of updates
      const summary = {
        totalGamesProcessed: results.length,
        totalLogsUpdated: results.reduce((sum, r) => sum + (r.logsUpdated || 0), 0),
        sports: [...new Set(results.map(r => r.sport))],
        timestamp: new Date().toISOString()
      };
      
      await this.broadcastUpdate('ultimate_stats:summary', summary);
      
      // 5. Update cache with latest processing time
      await this.redis.set('ultimate_stats:last_update', Date.now(), { ex: 300 });
      
      return summary;
      
    } catch (error) {
      console.error('Error processing latest stats:', error);
      throw error;
    }
  }

  // Process individual game and calculate ultimate stats
  private async processGame(game: any) {
    const startTime = Date.now();
    
    try {
      // 1. Fetch game logs that need metric updates
      const { data: logs, error } = await this.supabase
        .from('player_game_logs')
        .select('id, player_id, stats, computed_metrics, minutes_played')
        .eq('game_id', game.id)
        .not('stats', 'eq', '{}');
      
      if (error) throw error;
      if (!logs || logs.length === 0) return { gameId: game.id, logsUpdated: 0 };
      
      // 2. Calculate metrics for logs missing them or with stale data
      const updates = [];
      for (const log of logs) {
        const needsUpdate = this.needsMetricUpdate(log, game.updated_at);
        
        if (needsUpdate) {
          const metrics = this.calculateUltimateMetrics(log.stats, game.sport, log.minutes_played);
          if (Object.keys(metrics).length > 0) {
            updates.push({
              id: log.id,
              player_id: log.player_id,
              computed_metrics: metrics
            });
          }
        }
      }
      
      // 3. Batch update database
      if (updates.length > 0) {
        const { error: updateError } = await this.supabase
          .from('player_game_logs')
          .upsert(updates, { onConflict: 'id' });
        
        if (updateError) throw updateError;
        
        // 4. Broadcast player-specific updates
        for (const update of updates) {
          await this.broadcastUpdate(
            `player:${update.player_id}:stats`,
            {
              playerId: update.player_id,
              gameId: game.id,
              metrics: update.computed_metrics,
              sport: game.sport
            }
          );
        }
        
        // 5. Cache hot data
        await this.cacheGameMetrics(game.id, updates);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Processed game ${game.id}: ${updates.length} logs updated in ${processingTime}ms`);
      
      return {
        gameId: game.id,
        sport: game.sport,
        logsUpdated: updates.length,
        processingTime
      };
      
    } catch (error) {
      console.error(`Error processing game ${game.id}:`, error);
      return { gameId: game.id, logsUpdated: 0, error: error.message };
    }
  }

  // Determine if metrics need updating based on data freshness
  private needsMetricUpdate(log: any, gameUpdatedAt: string): boolean {
    // Always update if no metrics exist
    if (!log.computed_metrics || Object.keys(log.computed_metrics).length === 0) {
      return true;
    }
    
    // Check if metrics are stale (older than game update)
    const metricsTimestamp = log.computed_metrics._updated_at;
    if (metricsTimestamp && new Date(metricsTimestamp) < new Date(gameUpdatedAt)) {
      return true;
    }
    
    // Check for missing key metrics
    const requiredMetrics = ['true_shooting_pct', 'usage_rate', 'fantasy_points_estimate'];
    const hasAllMetrics = requiredMetrics.every(m => 
      log.computed_metrics[m] !== undefined && log.computed_metrics[m] !== null
    );
    
    return !hasAllMetrics;
  }

  // Calculate sport-specific ultimate metrics
  private calculateUltimateMetrics(stats: any, sport: string, minutesPlayed?: number): any {
    if (!stats || Object.keys(stats).length === 0) return {};
    
    let metrics: any = {};
    
    switch (sport) {
      case 'NBA':
        metrics = this.calculateNBAMetrics(stats, minutesPlayed);
        break;
      case 'NFL':
      case 'nfl':
        metrics = this.calculateNFLMetrics(stats);
        break;
      case 'NHL':
        metrics = this.calculateNHLMetrics(stats);
        break;
      case 'MLB':
        metrics = this.calculateMLBMetrics(stats);
        break;
    }
    
    // Add metadata
    metrics._updated_at = new Date().toISOString();
    metrics._version = '2.0';
    
    return metrics;
  }

  // NBA Advanced Metrics Calculator
  private calculateNBAMetrics(stats: any, minutesPlayed?: number): any {
    const metrics: any = {};
    
    // Parse stats with dual pattern support
    const pts = parseFloat(stats.points) || 0;
    const fga = parseFloat(stats.fieldGoalsAttempted || stats.field_goals_attempted) || 0;
    const fgm = parseFloat(stats.fieldGoalsMade || stats.field_goals_made) || 0;
    const fta = parseFloat(stats.freeThrowsAttempted || stats.free_throws_attempted) || 0;
    const ftm = parseFloat(stats.freeThrowsMade || stats.free_throws_made) || 0;
    const threeMade = parseFloat(stats.threePointersMade || stats.three_pointers_made) || 0;
    const threeAtt = parseFloat(stats.threePointersAttempted || stats.three_pointers_attempted) || 0;
    const ast = parseFloat(stats.assists) || 0;
    const to = parseFloat(stats.turnovers) || 0;
    const reb = parseFloat(stats.rebounds) || 0;
    const oreb = parseFloat(stats.offensiveRebounds || stats.offensive_rebounds) || 0;
    const stl = parseFloat(stats.steals) || 0;
    const blk = parseFloat(stats.blocks) || 0;
    const pf = parseFloat(stats.personalFouls || stats.personal_fouls) || 0;
    const min = parseFloat(minutesPlayed) || parseFloat(stats.minutes) || parseFloat(stats.minutes_played) || 0;
    
    // Core shooting metrics
    if (fga > 0) {
      metrics.field_goal_pct = (fgm / fga);
      metrics.effective_fg_pct = ((fgm + 0.5 * threeMade) / fga);
    }
    
    if (threeAtt > 0) {
      metrics.three_point_pct = (threeMade / threeAtt);
    }
    
    if (fta > 0) {
      metrics.free_throw_pct = (ftm / fta);
    }
    
    // True Shooting Percentage
    const tsa = fga + 0.44 * fta;
    if (tsa > 0) {
      metrics.true_shooting_pct = (pts / (2 * tsa));
    }
    
    // Usage Rate
    if (min > 0) {
      const teamPossEstimate = 96;
      const playerPoss = fga + 0.44 * fta + to;
      metrics.usage_rate = (playerPoss * 48) / (min * teamPossEstimate / 48);
      
      // Per minute stats
      metrics.points_per_minute = pts / min;
      metrics.rebounds_per_minute = reb / min;
      metrics.assists_per_minute = ast / min;
      metrics.stocks_per_minute = (stl + blk) / min;
    }
    
    // Assist to Turnover Ratio
    metrics.assist_to_turnover_ratio = to > 0 ? (ast / to) : ast;
    
    // Game Score (Hollinger)
    metrics.game_score = pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) + 
                        0.7 * (reb - oreb) + 0.3 * oreb + stl + 0.7 * ast + 
                        0.7 * blk - 0.4 * pf - to;
    
    // Fantasy Points (DraftKings scoring)
    metrics.fantasy_points_estimate = pts + (threeMade * 0.5) + (reb * 1.25) + 
                                     (ast * 1.5) + (stl * 2) + (blk * 2) - (to * 0.5) + 
                                     ((pts >= 10 && reb >= 10) || (pts >= 10 && ast >= 10) || 
                                      (reb >= 10 && ast >= 10) ? 1.5 : 0) + // Double-double
                                     ((pts >= 10 && reb >= 10 && ast >= 10) ? 3 : 0); // Triple-double
    
    // Round all metrics
    Object.keys(metrics).forEach(key => {
      if (typeof metrics[key] === 'number') {
        metrics[key] = Math.round(metrics[key] * 1000) / 1000;
      }
    });
    
    return metrics;
  }

  // NFL Advanced Metrics Calculator
  private calculateNFLMetrics(stats: any): any {
    const metrics: any = {};
    
    // Passing metrics
    const passAtt = parseFloat(stats.passing_attempts) || 0;
    const passComp = parseFloat(stats.passing_completions) || 0;
    const passYds = parseFloat(stats.passing_yards) || 0;
    const passTd = parseFloat(stats.passing_touchdowns) || 0;
    const passInt = parseFloat(stats.passing_interceptions) || 0;
    
    if (passAtt > 0) {
      // Passer Rating (NFL formula)
      const a = Math.max(0, Math.min(((passComp / passAtt) - 0.3) * 5, 2.375));
      const b = Math.max(0, Math.min(((passYds / passAtt) - 3) * 0.25, 2.375));
      const c = Math.max(0, Math.min((passTd / passAtt) * 20, 2.375));
      const d = Math.max(0, Math.min(2.375 - ((passInt / passAtt) * 25), 2.375));
      metrics.passer_rating = ((a + b + c + d) / 6) * 100;
      
      metrics.completion_percentage = passComp / passAtt;
      metrics.yards_per_attempt = passYds / passAtt;
      metrics.touchdown_percentage = passTd / passAtt;
      metrics.interception_percentage = passInt / passAtt;
    }
    
    // Rushing metrics
    const rushAtt = parseFloat(stats.rushing_attempts || stats.carries) || 0;
    const rushYds = parseFloat(stats.rushing_yards || stats.rushingYards) || 0;
    const rushTd = parseFloat(stats.rushing_touchdowns || stats.rushingTDs) || 0;
    
    if (rushAtt > 0) {
      metrics.yards_per_carry = rushYds / rushAtt;
      metrics.rushing_touchdown_rate = rushTd / rushAtt;
    }
    
    // Receiving metrics
    const targets = parseFloat(stats.targets) || 0;
    const rec = parseFloat(stats.receptions || stats.receiving_receptions) || 0;
    const recYds = parseFloat(stats.receiving_yards || stats.receivingYards) || 0;
    const recTd = parseFloat(stats.receiving_touchdowns || stats.receivingTDs) || 0;
    
    if (targets > 0) {
      metrics.catch_rate = rec / targets;
      metrics.yards_per_target = recYds / targets;
    }
    
    if (rec > 0) {
      metrics.yards_per_reception = recYds / rec;
    }
    
    // Defensive metrics
    const tackles = parseFloat(stats.defensive_tot || stats.defensive_solo) || 0;
    const sacks = parseFloat(stats.defensive_sacks) || 0;
    const defInt = parseFloat(stats.defensive_int) || 0;
    const defTd = parseFloat(stats.defensive_td) || 0;
    
    if (tackles > 0) {
      metrics.tackle_efficiency = sacks > 0 ? sacks / tackles : 0;
      metrics.defensive_impact = tackles + (sacks * 2) + (defInt * 3) + (defTd * 6);
    }
    
    // Total production
    metrics.total_yards = passYds + rushYds + recYds;
    metrics.total_touchdowns = passTd + rushTd + recTd + defTd;
    
    // Fantasy Points (DraftKings scoring)
    metrics.fantasy_points_estimate = 
      (passYds * 0.04) + (passTd * 4) - (passInt * 1) +
      (rushYds * 0.1) + (rushTd * 6) +
      (rec * 1) + (recYds * 0.1) + (recTd * 6) +
      (sacks * 1) + (defInt * 2) + (defTd * 6) +
      (passYds >= 300 ? 3 : 0) + (rushYds >= 100 ? 3 : 0) + (recYds >= 100 ? 3 : 0);
    
    // Round all metrics
    Object.keys(metrics).forEach(key => {
      if (typeof metrics[key] === 'number') {
        metrics[key] = Math.round(metrics[key] * 1000) / 1000;
      }
    });
    
    return metrics;
  }

  // NHL Advanced Metrics Calculator
  private calculateNHLMetrics(stats: any): any {
    const metrics: any = {};
    
    // Skater stats
    const goals = parseFloat(stats.goals) || 0;
    const assists = parseFloat(stats.assists) || 0;
    const shots = parseFloat(stats.shots) || 0;
    const hits = parseFloat(stats.hits) || 0;
    const blocks = parseFloat(stats.blockedShots || stats.blocks) || 0;
    const pim = parseFloat(stats.penaltyMinutes || stats.penalty_minutes) || 0;
    const plusMinus = parseFloat(stats.plusMinus || stats.plus_minus) || 0;
    
    // Time on ice conversion
    let toi = 0;
    if (stats.timeOnIce) {
      if (typeof stats.timeOnIce === 'string' && stats.timeOnIce.includes(':')) {
        const [min, sec] = stats.timeOnIce.split(':').map(parseFloat);
        toi = min + (sec / 60);
      } else {
        toi = parseFloat(stats.timeOnIce) || 0;
      }
    }
    
    // Basic metrics
    metrics.points = goals + assists;
    if (shots > 0) {
      metrics.shooting_percentage = goals / shots;
    }
    
    // Per 60 minute rates
    if (toi > 0) {
      metrics.goals_per_60 = (goals * 60) / toi;
      metrics.assists_per_60 = (assists * 60) / toi;
      metrics.points_per_60 = (metrics.points * 60) / toi;
      metrics.shots_per_60 = (shots * 60) / toi;
    }
    
    // Physical play
    metrics.hits_blocks_per_game = hits + blocks;
    
    // Goalie stats
    const saves = parseFloat(stats.saves) || 0;
    const shotsAgainst = parseFloat(stats.shotsAgainst || stats.shots_against) || 0;
    const goalsAgainst = parseFloat(stats.goalsAgainst || stats.goals_against) || 0;
    
    if (shotsAgainst > 0) {
      metrics.save_percentage = saves / shotsAgainst;
      
      // Quality start metric
      metrics.quality_start = (saves >= 20 && metrics.save_percentage >= 0.917) ? 1 : 0;
    }
    
    // Fantasy Points (DraftKings scoring)
    metrics.fantasy_points_estimate = 
      (goals * 3) + (assists * 2) + (shots * 0.5) + (blocks * 0.5) + 
      (plusMinus > 0 ? 1 : 0) + (plusMinus < 0 ? -1 : 0) +
      (saves * 0.35) + (goalsAgainst * -1) + (metrics.quality_start * 3);
    
    // Round all metrics
    Object.keys(metrics).forEach(key => {
      if (typeof metrics[key] === 'number') {
        metrics[key] = Math.round(metrics[key] * 1000) / 1000;
      }
    });
    
    return metrics;
  }

  // MLB Advanced Metrics Calculator (placeholder - fix data corruption first)
  private calculateMLBMetrics(stats: any): any {
    // MLB data is corrupted with basketball stats
    // Return empty metrics until data is fixed
    return {
      _error: 'MLB data contains basketball fields - metrics calculation skipped'
    };
  }

  // Get recent games that need processing
  private async getRecentGames(sport?: string, hoursBack: number = 24): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    let query = this.supabase
      .from('games')
      .select('id, sport, status, home_team, away_team, start_time, updated_at')
      .or('status.eq.in_progress,status.eq.completed')
      .gte('updated_at', cutoffTime)
      .order('updated_at', { ascending: false });
    
    if (sport) {
      query = query.eq('sport', sport);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) throw error;
    return data || [];
  }

  // Broadcast updates via WebSocket
  private async broadcastUpdate(channel: string, data: any) {
    try {
      await this.broadcaster.broadcast(channel, {
        type: 'ultimate_stats_update',
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Failed to broadcast to ${channel}:`, error);
    }
  }

  // Cache game metrics for fast access
  private async cacheGameMetrics(gameId: string, updates: any[]) {
    const cacheKey = `game:${gameId}:metrics`;
    const cacheTTL = 300; // 5 minutes
    
    try {
      const metricsMap = updates.reduce((acc, update) => {
        acc[update.player_id] = update.computed_metrics;
        return acc;
      }, {});
      
      await this.redis.set(cacheKey, JSON.stringify(metricsMap), { ex: cacheTTL });
    } catch (error) {
      console.error(`Failed to cache metrics for game ${gameId}:`, error);
    }
  }

  // Get cached metrics for a game
  async getCachedGameMetrics(gameId: string): Promise<any> {
    const cacheKey = `game:${gameId}:metrics`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached as string) : null;
    } catch (error) {
      console.error(`Failed to get cached metrics for game ${gameId}:`, error);
      return null;
    }
  }

  // Schedule automatic updates
  startScheduler() {
    console.log('🕐 Starting Ultimate Stats Scheduler...');
    
    // Regular update interval (2 minutes)
    setInterval(() => {
      this.processLatestStats().catch(console.error);
    }, this.updateInterval);
    
    // Live game rapid updates (30 seconds)
    setInterval(async () => {
      try {
        const { data: liveGames } = await this.supabase
          .from('games')
          .select('sport')
          .eq('status', 'in_progress');
        
        if (liveGames && liveGames.length > 0) {
          const sports = [...new Set(liveGames.map(g => g.sport))];
          for (const sport of sports) {
            await this.processLatestStats(sport);
          }
        }
      } catch (error) {
        console.error('Live game update error:', error);
      }
    }, this.liveGameInterval);
    
    // Initial run
    this.processLatestStats().catch(console.error);
  }
}

// Export singleton instance
export const ultimateStatsService = new UltimateStatsService();