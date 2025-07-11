import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BackfillProgress {
    sport: string;
    totalLogs: number;
    processedLogs: number;
    successfulLogs: number;
    failedLogs: number;
    startTime: number;
    currentBatch: number;
}

// Sport-specific metric calculators
class MetricCalculators {
    static calculateBasketballMetrics(stats: any, minutesPlayed: number): any {
        const metrics: any = {};
        
        // Only calculate if we have valid stats
        if (!stats || typeof stats !== 'object') return metrics;
        
        // True Shooting Percentage
        const fga = stats.fg_attempted || 0;
        const fta = stats.ft_attempted || 0;
        const pts = stats.points || 0;
        const tsa = fga + 0.44 * fta;
        metrics.true_shooting_pct = tsa > 0 ? pts / (2 * tsa) : 0;
        
        // Effective Field Goal Percentage
        const fgm = stats.fg_made || 0;
        const three_made = stats.three_made || 0;
        metrics.effective_fg_pct = fga > 0 ? (fgm + 0.5 * three_made) / fga : 0;
        
        // Assist to Turnover Ratio
        const ast = stats.assists || 0;
        const to = stats.turnovers || 0;
        metrics.assist_to_turnover_ratio = to > 0 ? ast / to : ast;
        
        // Usage Rate (simplified - need team totals for accurate calc)
        const possessions = fga + 0.44 * fta + to;
        metrics.usage_rate = minutesPlayed > 0 ? (possessions / minutesPlayed) * 48 : 0;
        
        // Player Impact Estimate
        const reb = stats.rebounds || 0;
        const stl = stats.steals || 0;
        const blk = stats.blocks || 0;
        const pf = stats.fouls || 0;
        
        metrics.game_score = pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - (stats.ft_made || 0)) 
            + 0.7 * (stats.offensive_rebounds || 0) + 0.3 * (reb - (stats.offensive_rebounds || 0))
            + stl + 0.7 * ast + 0.7 * blk - 0.4 * pf - to;
        
        // Double-Double and Triple-Double
        const doubleDigitStats = [pts, reb, ast, stl, blk].filter(stat => stat >= 10).length;
        metrics.double_double = doubleDigitStats >= 2;
        metrics.triple_double = doubleDigitStats >= 3;
        
        // Per 36 minutes stats
        if (minutesPlayed > 0) {
            const per36Factor = 36 / minutesPlayed;
            metrics.points_per_36 = pts * per36Factor;
            metrics.rebounds_per_36 = reb * per36Factor;
            metrics.assists_per_36 = ast * per36Factor;
        }
        
        // Shooting efficiency zones
        metrics.two_point_pct = fga > three_made ? 
            ((fgm - three_made) / (fga - (stats.three_attempted || 0))) : 0;
        metrics.free_throw_rate = fga > 0 ? fta / fga : 0;
        
        return metrics;
    }
    
    static calculateFootballMetrics(stats: any, position?: string): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        // QB Metrics
        if (stats.passing_attempts > 0) {
            const comp = stats.passing_completions || 0;
            const att = stats.passing_attempts;
            const yds = stats.passing_yards || 0;
            const td = stats.passing_touchdowns || 0;
            const int = stats.passing_interceptions || 0;
            
            metrics.completion_pct = comp / att;
            metrics.yards_per_attempt = yds / att;
            metrics.touchdown_pct = td / att;
            metrics.interception_pct = int / att;
            
            // NFL Passer Rating
            const a = Math.max(0, Math.min(2.375, ((comp / att) - 0.3) * 5));
            const b = Math.max(0, Math.min(2.375, ((yds / att) - 3) * 0.25));
            const c = Math.max(0, Math.min(2.375, (td / att) * 20));
            const d = Math.max(0, Math.min(2.375, 2.375 - (int / att) * 25));
            metrics.passer_rating = ((a + b + c + d) / 6) * 100;
            
            // Adjusted Yards per Attempt
            metrics.adjusted_yards_per_attempt = (yds + 20 * td - 45 * int) / att;
        }
        
        // RB Metrics
        if (stats.rushing_attempts > 0) {
            metrics.yards_per_carry = (stats.rushing_yards || 0) / stats.rushing_attempts;
            metrics.rushing_touchdown_pct = (stats.rushing_touchdowns || 0) / stats.rushing_attempts;
        }
        
        // WR/TE Metrics
        if (stats.receiving_targets > 0) {
            const rec = stats.receiving_receptions || 0;
            const tgt = stats.receiving_targets;
            metrics.catch_rate = rec / tgt;
            metrics.yards_per_target = (stats.receiving_yards || 0) / tgt;
            metrics.yards_per_reception = rec > 0 ? (stats.receiving_yards || 0) / rec : 0;
        }
        
        // All-purpose yards
        metrics.all_purpose_yards = (stats.rushing_yards || 0) + 
            (stats.receiving_yards || 0) + 
            (stats.return_yards || 0);
        
        // Scoring efficiency
        const totalTD = (stats.passing_touchdowns || 0) + 
            (stats.rushing_touchdowns || 0) + 
            (stats.receiving_touchdowns || 0);
        metrics.total_touchdowns = totalTD;
        
        return metrics;
    }
    
    static calculateBaseballMetrics(stats: any, isHitter: boolean): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        if (isHitter && stats.at_bats > 0) {
            const ab = stats.at_bats;
            const h = stats.hits || 0;
            const bb = stats.walks || 0;
            const hbp = stats.hit_by_pitch || 0;
            const sf = stats.sacrifice_flies || 0;
            const s = h - (stats.doubles || 0) - (stats.triples || 0) - (stats.home_runs || 0);
            const tb = s + 2 * (stats.doubles || 0) + 3 * (stats.triples || 0) + 4 * (stats.home_runs || 0);
            
            // Basic stats
            metrics.batting_average = h / ab;
            metrics.on_base_pct = (h + bb + hbp) / (ab + bb + hbp + sf);
            metrics.slugging_pct = tb / ab;
            metrics.ops = metrics.on_base_pct + metrics.slugging_pct;
            
            // Advanced stats
            metrics.isolated_power = metrics.slugging_pct - metrics.batting_average;
            metrics.walk_rate = bb / (ab + bb);
            metrics.strikeout_rate = (stats.strikeouts || 0) / (ab + bb);
            
            // BABIP (Batting Average on Balls In Play)
            const so = stats.strikeouts || 0;
            const hr = stats.home_runs || 0;
            metrics.babip = ab > so + hr ? (h - hr) / (ab - so - hr + sf) : 0;
        }
        
        if (!isHitter && stats.innings_pitched > 0) {
            const ip = stats.innings_pitched;
            const er = stats.earned_runs || 0;
            const h = stats.hits_allowed || 0;
            const bb = stats.walks_allowed || 0;
            const so = stats.strikeouts || 0;
            
            metrics.era = (er * 9) / ip;
            metrics.whip = (h + bb) / ip;
            metrics.k_per_9 = (so * 9) / ip;
            metrics.bb_per_9 = (bb * 9) / ip;
            metrics.h_per_9 = (h * 9) / ip;
            metrics.k_bb_ratio = bb > 0 ? so / bb : so;
            
            // FIP (Fielding Independent Pitching)
            const hr = stats.home_runs_allowed || 0;
            const hbp = stats.hit_batters || 0;
            metrics.fip = ((13 * hr + 3 * (bb + hbp) - 2 * so) / ip) + 3.2;
        }
        
        return metrics;
    }
    
    static calculateHockeyMetrics(stats: any, timeOnIce: number): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        const g = stats.goals || 0;
        const a = stats.assists || 0;
        
        metrics.points_total = g + a;
        metrics.shooting_pct = stats.shots > 0 ? g / stats.shots : 0;
        metrics.faceoff_pct = stats.faceoffs_total > 0 ? 
            (stats.faceoffs_won || 0) / stats.faceoffs_total : 0;
        
        // Per 60 minutes stats
        if (timeOnIce > 0) {
            const per60Factor = 3600 / timeOnIce; // timeOnIce in seconds
            metrics.goals_per_60 = g * per60Factor;
            metrics.assists_per_60 = a * per60Factor;
            metrics.points_per_60 = metrics.points_total * per60Factor;
            metrics.shots_per_60 = (stats.shots || 0) * per60Factor;
            metrics.plus_minus_per_60 = (stats.plus_minus || 0) * per60Factor;
        }
        
        // Special achievements
        metrics.hat_trick = g >= 3;
        metrics.gordie_howe_hat_trick = g >= 1 && a >= 1 && (stats.penalty_minutes || 0) >= 5;
        
        // Shooting metrics
        metrics.shot_attempts = (stats.shots || 0) + (stats.missed_shots || 0) + (stats.blocked_shots || 0);
        metrics.shots_on_goal_pct = metrics.shot_attempts > 0 ? 
            (stats.shots || 0) / metrics.shot_attempts : 0;
        
        return metrics;
    }
}

// Main backfill orchestrator
class SurgicalBackfill {
    private progress: Map<string, BackfillProgress> = new Map();
    private batchSize = 500;
    
    async analyzeCurrentState() {
        console.log('🔍 ANALYZING CURRENT DATABASE STATE');
        console.log('===================================\n');
        
        const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
        
        for (const sport of sports) {
            // Get games for this sport
            const { data: sportGames } = await supabase
                .from('games')
                .select('id')
                .eq('sport', sport);
                
            if (!sportGames || sportGames.length === 0) continue;
            
            const gameIds = sportGames.map(g => g.id);
            
            // Count total logs
            const { count: totalLogs } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds.slice(0, 1000));
                
            // Count logs with computed_metrics
            const { count: withMetrics } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds.slice(0, 1000))
                .not('computed_metrics', 'is', null);
                
            // Count logs with valid opponent_id
            const { count: withOpponent } = await supabase
                .from('player_game_logs')
                .select('*', { count: 'exact', head: true })
                .in('game_id', gameIds.slice(0, 1000))
                .not('opponent_id', 'is', null);
                
            const coverage = totalLogs ? ((withMetrics || 0) / totalLogs * 100).toFixed(1) : 0;
            const opponentCoverage = totalLogs ? ((withOpponent || 0) / totalLogs * 100).toFixed(1) : 0;
            
            console.log(`${sport}:`);
            console.log(`  Total logs: ${totalLogs?.toLocaleString() || 0}`);
            console.log(`  With metrics: ${withMetrics?.toLocaleString() || 0} (${coverage}%)`);
            console.log(`  With opponent: ${withOpponent?.toLocaleString() || 0} (${opponentCoverage}%)`);
            console.log(`  Need backfill: ${((totalLogs || 0) - (withMetrics || 0)).toLocaleString()}\n`);
            
            // Initialize progress tracking
            this.progress.set(sport, {
                sport,
                totalLogs: totalLogs || 0,
                processedLogs: withMetrics || 0,
                successfulLogs: 0,
                failedLogs: 0,
                startTime: Date.now(),
                currentBatch: 0
            });
        }
    }
    
    async backfillSport(sport: string) {
        console.log(`\n🏃 STARTING BACKFILL FOR ${sport}`);
        console.log('================================');
        
        const progress = this.progress.get(sport);
        if (!progress) return;
        
        // Get all game IDs for this sport
        const allGameIds: number[] = [];
        let gameOffset = 0;
        
        while (true) {
            const { data: games } = await supabase
                .from('games')
                .select('id')
                .eq('sport', sport)
                .range(gameOffset, gameOffset + 999);
                
            if (!games || games.length === 0) break;
            allGameIds.push(...games.map(g => g.id));
            if (games.length < 1000) break;
            gameOffset += 1000;
        }
        
        console.log(`Found ${allGameIds.length} ${sport} games\n`);
        
        // Process in batches
        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;
        
        while (processedCount < progress.totalLogs - progress.processedLogs) {
            // Get logs that need metrics
            const { data: logs } = await supabase
                .from('player_game_logs')
                .select('id, game_id, stats, minutes_played, fantasy_points, is_home, team_id')
                .in('game_id', allGameIds)
                .is('computed_metrics', null)
                .limit(this.batchSize);
                
            if (!logs || logs.length === 0) break;
            
            // Get game data for sport detection
            const gameIds = [...new Set(logs.map(l => l.game_id))];
            const { data: games } = await supabase
                .from('games')
                .select('id, home_team_id, away_team_id')
                .in('id', gameIds);
                
            const gameMap = new Map<number, any>();
            games?.forEach(g => gameMap.set(g.id, g));
            
            // Process each log
            const updates: any[] = [];
            
            for (const log of logs) {
                try {
                    let computed_metrics = {};
                    
                    // Calculate sport-specific metrics
                    switch (sport) {
                        case 'NBA':
                        case 'NCAA_BB':
                            computed_metrics = MetricCalculators.calculateBasketballMetrics(
                                log.stats, 
                                log.minutes_played || 0
                            );
                            break;
                            
                        case 'NFL':
                        case 'NCAA_FB':
                            computed_metrics = MetricCalculators.calculateFootballMetrics(log.stats);
                            break;
                            
                        case 'MLB':
                            const isHitter = log.stats?.at_bats !== undefined;
                            computed_metrics = MetricCalculators.calculateBaseballMetrics(
                                log.stats, 
                                isHitter
                            );
                            break;
                            
                        case 'NHL':
                            const timeOnIce = log.stats?.time_on_ice || log.minutes_played || 0;
                            computed_metrics = MetricCalculators.calculateHockeyMetrics(
                                log.stats, 
                                timeOnIce
                            );
                            break;
                    }
                    
                    // Also fix opponent_id if missing
                    const game = gameMap.get(log.game_id);
                    let opponent_id = null;
                    
                    if (game && log.is_home !== null) {
                        opponent_id = log.is_home ? game.away_team_id : game.home_team_id;
                    } else if (game && log.team_id) {
                        // Infer from team_id
                        const is_home = log.team_id === game.home_team_id;
                        opponent_id = is_home ? game.away_team_id : game.home_team_id;
                        
                        updates.push({
                            id: log.id,
                            computed_metrics,
                            opponent_id,
                            is_home
                        });
                    } else {
                        updates.push({
                            id: log.id,
                            computed_metrics
                        });
                    }
                    
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error(`Error processing log ${log.id}:`, error);
                }
            }
            
            // Batch update
            if (updates.length > 0) {
                for (let i = 0; i < updates.length; i += 100) {
                    const batch = updates.slice(i, i + 100);
                    
                    for (const update of batch) {
                        await supabase
                            .from('player_game_logs')
                            .update({
                                computed_metrics: update.computed_metrics,
                                opponent_id: update.opponent_id,
                                is_home: update.is_home
                            })
                            .eq('id', update.id);
                    }
                }
            }
            
            processedCount += logs.length;
            progress.currentBatch++;
            
            // Progress report
            const elapsed = (Date.now() - progress.startTime) / 1000;
            const rate = processedCount / elapsed;
            const remaining = (progress.totalLogs - progress.processedLogs - processedCount) / rate;
            
            console.log(`Batch ${progress.currentBatch}: Processed ${processedCount.toLocaleString()} logs`);
            console.log(`  Success: ${successCount} | Failed: ${failCount}`);
            console.log(`  Rate: ${rate.toFixed(0)} logs/sec | ETA: ${(remaining / 60).toFixed(1)} min\n`);
        }
        
        // Final stats
        console.log(`✅ ${sport} BACKFILL COMPLETE!`);
        console.log(`   Processed: ${processedCount.toLocaleString()}`);
        console.log(`   Successful: ${successCount.toLocaleString()}`);
        console.log(`   Failed: ${failCount.toLocaleString()}`);
        console.log(`   Time: ${((Date.now() - progress.startTime) / 60000).toFixed(1)} minutes`);
    }
    
    async validateBackfill() {
        console.log('\n\n🔍 VALIDATING BACKFILL RESULTS');
        console.log('==============================\n');
        
        for (const [sport, progress] of this.progress) {
            // Re-check coverage
            const { data: sportGames } = await supabase
                .from('games')
                .select('id')
                .eq('sport', sport);
                
            if (!sportGames || sportGames.length === 0) continue;
            
            const gameIds = sportGames.map(g => g.id).slice(0, 1000);
            
            // Sample some logs to check quality
            const { data: sample } = await supabase
                .from('player_game_logs')
                .select('computed_metrics, opponent_id, is_home')
                .in('game_id', gameIds)
                .not('computed_metrics', 'is', null)
                .limit(10);
                
            console.log(`${sport} Sample Validation:`);
            
            if (sample && sample.length > 0) {
                // Check metric coverage
                const metricKeys = new Set<string>();
                let hasOpponent = 0;
                let hasIsHome = 0;
                
                sample.forEach(log => {
                    if (log.computed_metrics) {
                        Object.keys(log.computed_metrics).forEach(k => metricKeys.add(k));
                    }
                    if (log.opponent_id) hasOpponent++;
                    if (log.is_home !== null) hasIsHome++;
                });
                
                console.log(`  Metrics found: ${Array.from(metricKeys).join(', ')}`);
                console.log(`  With opponent_id: ${hasOpponent}/${sample.length}`);
                console.log(`  With is_home: ${hasIsHome}/${sample.length}\n`);
            }
        }
    }
}

// Main execution
async function runSurgicalBackfill() {
    console.log('🏥 SURGICAL BACKFILL FOR ADVANCED METRICS');
    console.log('========================================');
    console.log('Precise, sport-specific metric calculation\n');
    
    const backfiller = new SurgicalBackfill();
    
    // 1. Analyze current state
    await backfiller.analyzeCurrentState();
    
    // 2. Ask for confirmation
    console.log('\nThis will process hundreds of thousands of records.');
    console.log('Recommended: Run one sport at a time.\n');
    
    // 3. Process each sport
    const sportsToProcess = ['NBA', 'NCAA_BB', 'NHL', 'NFL', 'NCAA_FB', 'MLB'];
    
    for (const sport of sportsToProcess) {
        await backfiller.backfillSport(sport);
        
        // Small delay between sports
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 4. Validate results
    await backfiller.validateBackfill();
    
    console.log('\n\n🎉 SURGICAL BACKFILL COMPLETE!');
    console.log('All historical data now has advanced metrics.');
    console.log('Future data will be collected with metrics from the start!');
}

// Allow running individual sports
const sportArg = process.argv[2];
if (sportArg) {
    console.log(`Running backfill for ${sportArg} only...\n`);
    const backfiller = new SurgicalBackfill();
    backfiller.analyzeCurrentState()
        .then(() => backfiller.backfillSport(sportArg))
        .then(() => backfiller.validateBackfill())
        .catch(console.error);
} else {
    runSurgicalBackfill().catch(console.error);
}