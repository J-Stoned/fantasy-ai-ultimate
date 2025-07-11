import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sport-specific metric calculators (from surgical-backfill-advanced-metrics.ts)
class MetricCalculators {
    static calculateBasketballMetrics(stats: any, minutesPlayed: number): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        // Parse numbers - HANDLE BOTH CAMELCASE AND SNAKE_CASE NBA PATTERNS!
        const pts = parseFloat(stats.points) || 0;
        
        // Field goals - try both patterns
        const fga = parseFloat(stats.field_goals_attempted || stats.fieldGoalsAttempted) || 0;
        const fgm = parseFloat(stats.field_goals_made || stats.fieldGoalsMade) || 0;
        
        // Free throws - try both patterns  
        const fta = parseFloat(stats.free_throws_attempted || stats.freeThrowsAttempted) || 0;
        const ftm = parseFloat(stats.free_throws_made || stats.freeThrowsMade) || 0;
        
        // Three pointers - try both patterns
        const three_made = parseFloat(stats.three_pointers_made || stats.threePointersMade) || 0;
        const three_att = parseFloat(stats.three_pointers_attempted || stats.threePointersAttempted) || 0;
        
        // Other stats - try both patterns
        const ast = parseFloat(stats.assists) || 0;
        const to = parseFloat(stats.turnovers) || 0;
        const reb = parseFloat(stats.rebounds) || 0;
        const stl = parseFloat(stats.steals) || 0;
        const blk = parseFloat(stats.blocks) || 0;
        
        // Minutes - try multiple patterns
        const min = parseFloat(minutesPlayed) || parseFloat(stats.minutes_played) || parseFloat(stats.minutes) || 0;
        
        // True Shooting Percentage
        const tsa = fga + 0.44 * fta;
        metrics.true_shooting_pct = tsa > 0 ? (pts / (2 * tsa)) : 0;
        
        // Effective Field Goal Percentage
        metrics.effective_fg_pct = fga > 0 ? ((fgm + 0.5 * three_made) / fga) : 0;
        
        // Field Goal Percentage
        metrics.field_goal_pct = fga > 0 ? (fgm / fga) : 0;
        
        // Three Point Percentage
        metrics.three_point_pct = three_att > 0 ? (three_made / three_att) : 0;
        
        // Free Throw Percentage
        metrics.free_throw_pct = fta > 0 ? (ftm / fta) : 0;
        
        // Assist to Turnover Ratio
        metrics.assist_to_turnover_ratio = to > 0 ? (ast / to) : ast;
        
        // Usage Rate (simplified version)
        const team_possessions_estimate = 96; // NBA average
        const player_possessions = fga + 0.44 * fta + to;
        metrics.usage_rate = min > 0 ? ((player_possessions * 48) / (min * team_possessions_estimate / 48)) : 0;
        
        // Per minute stats
        if (min > 0) {
            metrics.points_per_minute = pts / min;
            metrics.rebounds_per_minute = reb / min;
            metrics.assists_per_minute = ast / min;
            metrics.stocks_per_minute = (stl + blk) / min; // Steals + blocks
        }
        
        // Points per shot attempt
        metrics.points_per_shot = tsa > 0 ? (pts / tsa) : 0;
        
        // Game Score (John Hollinger's metric) - handle both patterns
        const oreb = parseFloat(stats.offensive_rebounds || stats.offensiveRebounds) || 0;
        const fouls = parseFloat(stats.personal_fouls || stats.personalFouls) || 0;
        
        metrics.game_score = pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) + 
                           0.7 * (reb - oreb) + 0.3 * oreb + 
                           stl + 0.7 * ast + 0.7 * blk - 0.4 * fouls - to;
        
        // Round all metrics to 3 decimal places
        Object.keys(metrics).forEach(key => {
            if (typeof metrics[key] === 'number') {
                metrics[key] = Math.round(metrics[key] * 1000) / 1000;
            }
        });
        
        return metrics;
    }
    
    static calculateFootballMetrics(stats: any): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        // Handle TWO different NFL formats - uppercase and lowercase
        
        // Passing stats - handle both patterns
        const att = parseFloat(stats.passing_attempts) || 0;
        const comp = parseFloat(stats.passing_completions) || 0;
        const passYds = parseFloat(stats.passing_yards) || 0;
        const passTd = parseFloat(stats.passing_touchdowns) || 0;
        const int = parseFloat(stats.passing_interceptions) || 0;
        
        // Rushing stats - handle both patterns  
        const rushAtt = parseFloat(stats.rushing_attempts || stats.carries) || 0;
        const rushYds = parseFloat(stats.rushing_yards || stats.rushingYards) || 0;
        const rushTd = parseFloat(stats.rushing_touchdowns || stats.rushingTDs) || 0;
        
        // Receiving stats - handle both patterns
        const targets = parseFloat(stats.targets) || 0;
        const rec = parseFloat(stats.receiving_receptions || stats.receptions) || 0;
        const recYds = parseFloat(stats.receiving_yards || stats.receivingYards) || 0;
        const recTd = parseFloat(stats.receiving_touchdowns || stats.receivingTDs) || 0;
        
        // Defensive stats - handle strings and different patterns
        const defTd = parseFloat(stats.defensive_td) || 0;
        const tackles = parseFloat(stats.defensive_tot || stats.defensive_solo) || 0;
        const sacks = parseFloat(stats.defensive_sacks) || 0;
        const tfl = parseFloat(stats.defensive_tfl) || 0;
        
        // Passer Rating (NFL formula)
        if (att > 0) {
            const a = Math.max(0, Math.min(((comp / att) - 0.3) * 5, 2.375));
            const b = Math.max(0, Math.min(((passYds / att) - 3) * 0.25, 2.375));
            const c = Math.max(0, Math.min((passTd / att) * 20, 2.375));
            const d = Math.max(0, Math.min(2.375 - ((int / att) * 25), 2.375));
            metrics.passer_rating = ((a + b + c + d) / 6) * 100;
            
            metrics.yards_per_attempt = passYds / att;
            metrics.completion_percentage = comp / att;
            metrics.touchdown_percentage = passTd / att;
            metrics.interception_percentage = int / att;
        }
        
        // Rushing metrics
        if (rushAtt > 0) {
            metrics.yards_per_carry = rushYds / rushAtt;
            metrics.rushing_touchdown_rate = rushTd / rushAtt;
        }
        
        // Receiving metrics
        if (targets > 0) {
            metrics.catch_rate = rec / targets;
            metrics.yards_per_target = recYds / targets;
        }
        if (rec > 0) {
            metrics.yards_per_reception = recYds / rec;
        }
        
        // Total yards from scrimmage
        metrics.total_yards = passYds + rushYds + recYds;
        metrics.total_touchdowns = passTd + rushTd + recTd;
        
        // Defensive metrics
        if (tackles > 0) {
            metrics.tackle_efficiency = sacks > 0 ? sacks / tackles : 0;
            metrics.defensive_impact = tackles + (sacks * 2) + (tfl * 1.5) + (defTd * 6);
        }
        
        // Enhanced fantasy points with defensive stats
        metrics.fantasy_points_estimate = (passYds * 0.04) + (passTd * 4) - (int * 2) +
                                        (rushYds * 0.1) + (rushTd * 6) +
                                        (recYds * 0.1) + (rec * 0.5) + (recTd * 6) +
                                        (tackles * 1) + (sacks * 2) + (defTd * 6);
        
        // Round all metrics
        Object.keys(metrics).forEach(key => {
            if (typeof metrics[key] === 'number') {
                metrics[key] = Math.round(metrics[key] * 1000) / 1000;
            }
        });
        
        return metrics;
    }
    
    static calculateBaseballMetrics(stats: any): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        // Parse batting stats
        const ab = parseFloat(stats.at_bats) || 0;
        const h = parseFloat(stats.hits) || 0;
        const doubles = parseFloat(stats.doubles) || 0;
        const triples = parseFloat(stats.triples) || 0;
        const hr = parseFloat(stats.home_runs) || 0;
        const r = parseFloat(stats.runs) || 0;
        const rbi = parseFloat(stats.runs_batted_in) || 0;
        const bb = parseFloat(stats.walks) || 0;
        const k = parseFloat(stats.strikeouts) || 0;
        const sb = parseFloat(stats.stolen_bases) || 0;
        const cs = parseFloat(stats.caught_stealing) || 0;
        const hbp = parseFloat(stats.hit_by_pitch) || 0;
        const sf = parseFloat(stats.sacrifice_flies) || 0;
        
        // Batting metrics
        if (ab > 0) {
            metrics.batting_average = h / ab;
            
            // Calculate total bases
            const singles = h - doubles - triples - hr;
            const tb = singles + (2 * doubles) + (3 * triples) + (4 * hr);
            metrics.slugging_percentage = tb / ab;
            
            // On-base percentage
            const obpDenom = ab + bb + hbp + sf;
            metrics.on_base_percentage = obpDenom > 0 ? (h + bb + hbp) / obpDenom : 0;
            
            // OPS
            metrics.ops = metrics.on_base_percentage + metrics.slugging_percentage;
            
            // ISO (Isolated Power)
            metrics.isolated_power = metrics.slugging_percentage - metrics.batting_average;
            
            // BABIP
            const babipDenom = ab - k - hr + sf;
            metrics.babip = babipDenom > 0 ? (h - hr) / babipDenom : 0;
        }
        
        // Stolen base percentage
        const sbAttempts = sb + cs;
        metrics.stolen_base_percentage = sbAttempts > 0 ? sb / sbAttempts : 0;
        
        // Parse pitching stats
        const ip = parseFloat(stats.innings_pitched) || 0;
        const er = parseFloat(stats.earned_runs) || 0;
        const hits_allowed = parseFloat(stats.hits_allowed) || 0;
        const walks_allowed = parseFloat(stats.walks_allowed) || 0;
        const k_pitch = parseFloat(stats.strikeouts) || 0; // Pitching strikeouts
        const hr_allowed = parseFloat(stats.home_runs_allowed) || 0;
        
        // Pitching metrics
        if (ip > 0) {
            metrics.era = (er * 9) / ip;
            metrics.whip = (walks_allowed + hits_allowed) / ip;
            metrics.k_per_9 = (k_pitch * 9) / ip;
            metrics.bb_per_9 = (walks_allowed * 9) / ip;
            metrics.hr_per_9 = (hr_allowed * 9) / ip;
            metrics.k_bb_ratio = walks_allowed > 0 ? k_pitch / walks_allowed : k_pitch;
        }
        
        // Round all metrics
        Object.keys(metrics).forEach(key => {
            if (typeof metrics[key] === 'number') {
                metrics[key] = Math.round(metrics[key] * 1000) / 1000;
            }
        });
        
        return metrics;
    }
    
    static calculateHockeyMetrics(stats: any): any {
        const metrics: any = {};
        
        if (!stats || typeof stats !== 'object') return metrics;
        
        // Parse skater stats - use actual field names from discovery
        const goals = parseFloat(stats.goals) || 0;
        const assists = parseFloat(stats.assists) || 0;
        const shots = parseFloat(stats.shots) || 0;
        const pim = parseFloat(stats.penaltyMinutes || stats.penalty_minutes) || 0;
        const plusMinus = parseFloat(stats.plusMinus || stats.plus_minus) || 0;
        const ppg = parseFloat(stats.power_play_goals) || 0;
        const ppa = parseFloat(stats.power_play_assists) || 0;
        const shg = parseFloat(stats.short_handed_goals) || 0;
        const hits = parseFloat(stats.hits) || 0;
        const blocks = parseFloat(stats.blockedShots || stats.blocks) || 0;
        
        // Handle timeOnIce string conversion (MM:SS format)
        let toi = 0;
        if (stats.timeOnIce && typeof stats.timeOnIce === 'string') {
            const timeParts = stats.timeOnIce.split(':');
            if (timeParts.length === 2) {
                toi = parseFloat(timeParts[0]) + (parseFloat(timeParts[1]) / 60);
            } else {
                toi = parseFloat(stats.timeOnIce) || 0;
            }
        } else {
            toi = parseFloat(stats.time_on_ice || stats.timeOnIce) || 0;
        }
        
        // Basic metrics
        metrics.points = goals + assists;
        metrics.shooting_percentage = shots > 0 ? goals / shots : 0;
        metrics.power_play_points = ppg + ppa;
        
        // Per 60 minutes rates
        if (toi > 0) {
            metrics.goals_per_60 = (goals * 60) / toi;
            metrics.assists_per_60 = (assists * 60) / toi;
            metrics.points_per_60 = (metrics.points * 60) / toi;
            metrics.shots_per_60 = (shots * 60) / toi;
        }
        
        // Physical play metric
        metrics.hits_blocks_per_game = hits + blocks;
        
        // Parse goalie stats - use actual field names
        const saves = parseFloat(stats.saves) || 0;
        const shots_against = parseFloat(stats.shotsAgainst || stats.shots_against) || 0;
        const goals_against = parseFloat(stats.goalsAgainst || stats.goals_against) || 0;
        const minutes_played = parseFloat(stats.minutes_played) || 0;
        
        // Goalie metrics
        if (shots_against > 0) {
            metrics.save_percentage = saves / shots_against;
        }
        if (minutes_played > 0) {
            metrics.goals_against_average = (goals_against * 60) / minutes_played;
        }
        
        // Quality start (unofficial metric)
        if (saves >= 20 && metrics.save_percentage >= 0.917) {
            metrics.quality_start = 1;
        } else {
            metrics.quality_start = 0;
        }
        
        // Round all metrics
        Object.keys(metrics).forEach(key => {
            if (typeof metrics[key] === 'number') {
                metrics[key] = Math.round(metrics[key] * 1000) / 1000;
            }
        });
        
        return metrics;
    }
}

async function forceBackfillEmptyMetrics() {
    console.log('🚀 FORCE BACKFILL FOR EMPTY COMPUTED_METRICS');
    console.log('=========================================\n');
    
    // Use GAMES.SPORT instead of players.sport to access all data!
    const sports = [
        { name: 'NBA', query: 'NBA' },
        { name: 'NFL_uppercase', query: 'NFL' }, 
        { name: 'NFL_lowercase', query: 'nfl' },
        { name: 'NHL', query: 'NHL' }
        // Skip MLB due to data corruption (basketball stats)
    ];
    const batchSize = 500; // Increased from 100 to 500 for faster processing
    
    for (const sport of sports) {
        console.log(`\n📊 Processing ${sport.name} (games.sport = "${sport.query}")...`);
        
        // First get game IDs for this sport
        const { data: gameIds } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport.query);
        
        if (!gameIds || gameIds.length === 0) {
            console.log(`No games found for sport "${sport.query}"`);
            continue;
        }
        
        const gameIdList = gameIds.map(g => g.id);
        
        // Count ALL logs for this sport using manual join
        const { count } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIdList);
        
        console.log(`Found ${gameIds.length} games and ${count || 0} total logs to process`);
        
        if (!count || count === 0) continue;
        
        // Process in batches
        let processed = 0;
        let successful = 0;
        
        while (processed < count) {
            // Get batch of ALL logs for this sport using manual join
            const { data: logs, error } = await supabase
                .from('player_game_logs')
                .select(`
                    id,
                    stats,
                    minutes_played,
                    player_id
                `)
                .in('game_id', gameIdList)
                .range(processed, processed + batchSize - 1);
            
            if (error) {
                console.error(`Error fetching logs: ${error.message}`);
                break;
            }
            
            if (!logs || logs.length === 0) break;
            
            // Calculate metrics for each log
            const updates = logs.map(log => {
                let metrics = {};
                
                switch (sport.name) {
                    case 'NBA':
                    case 'NCAA_BB':
                        metrics = MetricCalculators.calculateBasketballMetrics(
                            log.stats, 
                            log.minutes_played || 0
                        );
                        break;
                    case 'NFL_uppercase':
                    case 'NFL_lowercase':
                    case 'NCAA_FB':
                        metrics = MetricCalculators.calculateFootballMetrics(log.stats);
                        break;
                    case 'MLB':
                        metrics = MetricCalculators.calculateBaseballMetrics(log.stats);
                        break;
                    case 'NHL':
                        metrics = MetricCalculators.calculateHockeyMetrics(log.stats);
                        break;
                }
                
                return {
                    id: log.id,
                    computed_metrics: metrics
                };
            });
            
            // Update in batches of 50 for efficiency
            const updateBatchSize = 50;
            for (let i = 0; i < updates.length; i += updateBatchSize) {
                const batch = updates.slice(i, i + updateBatchSize);
                
                // Use Promise.all for parallel updates within each mini-batch
                const results = await Promise.all(
                    batch.map(update => 
                        supabase
                            .from('player_game_logs')
                            .update({ computed_metrics: update.computed_metrics })
                            .eq('id', update.id)
                    )
                );
                
                successful += results.filter(r => !r.error).length;
            }
            
            processed += logs.length;
            console.log(`Progress: ${processed}/${count} (${successful} successful)`);
        }
        
        console.log(`✅ ${sport.name} complete: ${successful}/${count} logs updated`);
    }
    
    console.log('\n🎉 BACKFILL COMPLETE!');
}

// Run based on command line args
const args = process.argv.slice(2);
const testMode = args.includes('--test');

if (testMode) {
    console.log('TEST MODE: Will process first 10 logs per sport\n');
}

forceBackfillEmptyMetrics()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Backfill failed:', error);
        process.exit(1);
    });