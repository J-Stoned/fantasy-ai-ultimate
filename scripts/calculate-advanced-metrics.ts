import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Stats {
    [key: string]: number;
}

interface AdvancedMetrics {
    [key: string]: number | boolean;
}

// Calculate basketball advanced metrics
function calculateBasketballMetrics(stats: Stats): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    // True Shooting Percentage
    const tsa = stats.fg_attempted + 0.44 * (stats.ft_attempted || 0);
    metrics.true_shooting_pct = tsa > 0 ? stats.points / (2 * tsa) : 0;
    
    // Effective Field Goal Percentage
    metrics.effective_fg_pct = stats.fg_attempted > 0 
        ? (stats.fg_made + 0.5 * (stats.three_made || 0)) / stats.fg_attempted 
        : 0;
    
    // Assist to Turnover Ratio
    metrics.assist_to_turnover_ratio = stats.turnovers > 0 
        ? stats.assists / stats.turnovers 
        : stats.assists;
    
    // Usage Rate (simplified - would need team stats for accurate calculation)
    const possessions = stats.fg_attempted + 0.44 * (stats.ft_attempted || 0) + (stats.turnovers || 0);
    metrics.usage_rate = possessions / (stats.minutes_played || 1) * 48; // Normalized to 48 minutes
    
    // Double-Double and Triple-Double
    const doubleDigitStats = [
        stats.points >= 10,
        stats.rebounds >= 10,
        stats.assists >= 10,
        stats.steals >= 10,
        stats.blocks >= 10
    ].filter(x => x).length;
    
    metrics.double_double = doubleDigitStats >= 2;
    metrics.triple_double = doubleDigitStats >= 3;
    
    // Player Efficiency Rating (simplified)
    metrics.game_score = stats.points + 0.4 * stats.fg_made - 0.7 * stats.fg_attempted 
        - 0.4 * (stats.ft_attempted - stats.ft_made) + 0.7 * (stats.offensive_rebounds || 0) 
        + 0.3 * (stats.defensive_rebounds || stats.rebounds - (stats.offensive_rebounds || 0))
        + stats.steals + 0.7 * stats.assists + 0.7 * stats.blocks 
        - 0.4 * (stats.fouls || 0) - stats.turnovers;
    
    // Offensive and Defensive Rating would require team data
    
    return metrics;
}

// Calculate football advanced metrics
function calculateFootballMetrics(stats: Stats): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    // QB metrics
    if (stats.passing_attempts > 0) {
        metrics.completion_pct = stats.passing_completions / stats.passing_attempts;
        metrics.yards_per_attempt = stats.passing_yards / stats.passing_attempts;
        metrics.touchdown_pct = (stats.passing_touchdowns || 0) / stats.passing_attempts;
        metrics.interception_pct = (stats.passing_interceptions || 0) / stats.passing_attempts;
        
        // Passer Rating
        const a = Math.max(0, Math.min(2.375, ((stats.passing_completions / stats.passing_attempts) - 0.3) * 5));
        const b = Math.max(0, Math.min(2.375, ((stats.passing_yards / stats.passing_attempts) - 3) * 0.25));
        const c = Math.max(0, Math.min(2.375, ((stats.passing_touchdowns || 0) / stats.passing_attempts) * 20));
        const d = Math.max(0, Math.min(2.375, 2.375 - ((stats.passing_interceptions || 0) / stats.passing_attempts) * 25));
        metrics.passer_rating = ((a + b + c + d) / 6) * 100;
    }
    
    // RB metrics
    if (stats.rushing_attempts > 0) {
        metrics.yards_per_carry = stats.rushing_yards / stats.rushing_attempts;
        metrics.rushing_success_rate = (stats.rushing_first_downs || 0) / stats.rushing_attempts;
    }
    
    // WR/TE metrics
    if (stats.receiving_targets > 0) {
        metrics.catch_rate = stats.receiving_receptions / stats.receiving_targets;
        metrics.yards_per_reception = stats.receiving_yards / Math.max(1, stats.receiving_receptions);
        metrics.yards_per_target = stats.receiving_yards / stats.receiving_targets;
    }
    
    return metrics;
}

// Calculate baseball advanced metrics
function calculateBaseballMetrics(stats: Stats): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    // Batting metrics
    if (stats.at_bats > 0) {
        metrics.batting_average = stats.hits / stats.at_bats;
        metrics.on_base_pct = (stats.hits + (stats.walks || 0) + (stats.hit_by_pitch || 0)) / 
            (stats.at_bats + (stats.walks || 0) + (stats.hit_by_pitch || 0) + (stats.sacrifice_flies || 0));
        
        const singles = stats.hits - (stats.doubles || 0) - (stats.triples || 0) - (stats.home_runs || 0);
        const total_bases = singles + 2 * (stats.doubles || 0) + 3 * (stats.triples || 0) + 4 * (stats.home_runs || 0);
        metrics.slugging_pct = total_bases / stats.at_bats;
        metrics.ops = metrics.on_base_pct + metrics.slugging_pct;
        
        // Isolated Power
        metrics.isolated_power = metrics.slugging_pct - metrics.batting_average;
    }
    
    // Pitching metrics
    if (stats.innings_pitched > 0) {
        metrics.era = (stats.earned_runs * 9) / stats.innings_pitched;
        metrics.whip = ((stats.walks_allowed || 0) + stats.hits_allowed) / stats.innings_pitched;
        metrics.k_per_9 = (stats.strikeouts * 9) / stats.innings_pitched;
        metrics.bb_per_9 = ((stats.walks_allowed || 0) * 9) / stats.innings_pitched;
        metrics.k_bb_ratio = stats.strikeouts / Math.max(1, (stats.walks_allowed || 0));
    }
    
    return metrics;
}

// Calculate hockey advanced metrics
function calculateHockeyMetrics(stats: Stats): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    metrics.points_total = stats.goals + stats.assists;
    metrics.shooting_pct = stats.shots > 0 ? stats.goals / stats.shots : 0;
    metrics.faceoff_pct = stats.faceoffs_total > 0 ? stats.faceoffs_won / stats.faceoffs_total : 0;
    
    // Plus/Minus per 60 minutes
    if (stats.time_on_ice > 0) {
        metrics.plus_minus_per_60 = (stats.plus_minus * 60) / stats.time_on_ice;
        metrics.points_per_60 = (metrics.points_total * 60) / stats.time_on_ice;
    }
    
    // Penalty differential
    metrics.penalty_differential = (stats.penalties_drawn || 0) - (stats.penalties || 0);
    
    // Hat trick
    metrics.hat_trick = stats.goals >= 3;
    
    // Gordie Howe hat trick
    metrics.gordie_howe_hat_trick = stats.goals >= 1 && stats.assists >= 1 && (stats.fights || 0) >= 1;
    
    return metrics;
}

// Calculate soccer advanced metrics
function calculateSoccerMetrics(stats: Stats): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    metrics.goals_plus_assists = stats.goals + stats.assists;
    metrics.shooting_accuracy = stats.shots > 0 ? stats.shots_on_target / stats.shots : 0;
    metrics.pass_completion_rate = stats.passes_attempted > 0 ? stats.passes_completed / stats.passes_attempted : 0;
    
    // Defensive metrics
    metrics.tackle_success_rate = stats.tackles_attempted > 0 ? stats.tackles_won / stats.tackles_attempted : 0;
    metrics.duel_success_rate = stats.duels_total > 0 ? stats.duels_won / stats.duels_total : 0;
    
    // Advanced metrics (would need more data for xG, xA)
    metrics.key_passes_per_90 = stats.minutes_played > 0 ? (stats.key_passes * 90) / stats.minutes_played : 0;
    metrics.shots_per_90 = stats.minutes_played > 0 ? (stats.shots * 90) / stats.minutes_played : 0;
    
    // Hat trick
    metrics.hat_trick = stats.goals >= 3;
    
    // Clean sheet (for goalkeepers)
    if (stats.position === 'GK') {
        metrics.clean_sheet = stats.goals_conceded === 0;
        metrics.save_pct = stats.shots_faced > 0 ? stats.saves / stats.shots_faced : 0;
    }
    
    return metrics;
}

// Universal metrics that apply to all sports
function calculateUniversalMetrics(stats: Stats, sport: string): AdvancedMetrics {
    const metrics: AdvancedMetrics = {};
    
    // Minutes/Time efficiency
    if (stats.minutes_played > 0 || stats.time_on_ice > 0) {
        const minutes = stats.minutes_played || stats.time_on_ice || 0;
        metrics.fantasy_points_per_minute = stats.fantasy_points / minutes;
        
        // Activity rate (actions per minute)
        const totalActions = Object.values(stats).reduce((sum, val) => 
            typeof val === 'number' ? sum + Math.abs(val) : sum, 0);
        metrics.activity_rate = totalActions / minutes;
    }
    
    // Consistency score would be calculated across games
    // Impact score would need team performance data
    
    return metrics;
}

async function calculateAndStoreMetrics() {
    console.log('🧮 CALCULATING ADVANCED METRICS FOR ALL SPORTS');
    console.log('===========================================\n');
    
    // Process each sport
    const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
    
    for (const sport of sports) {
        console.log(`\n📊 Processing ${sport}...`);
        
        // Get games for this sport
        const { data: games } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport)
            .limit(1000);
            
        if (!games || games.length === 0) continue;
        
        const gameIds = games.map(g => g.id);
        
        // Get logs for these games
        let offset = 0;
        let processedCount = 0;
        
        while (true) {
            const { data: logs } = await supabase
                .from('player_game_logs')
                .select('id, stats, game_id, player_id, is_home')
                .in('game_id', gameIds)
                .is('computed_metrics', null)
                .range(offset, offset + 999);
                
            if (!logs || logs.length === 0) break;
            
            // Calculate metrics for each log
            const updates = logs.map(log => {
                let advancedMetrics: AdvancedMetrics = {};
                
                if (log.stats) {
                    // Sport-specific metrics
                    switch (sport) {
                        case 'NBA':
                        case 'NCAA_BB':
                            advancedMetrics = {
                                ...calculateBasketballMetrics(log.stats as Stats),
                                ...calculateUniversalMetrics(log.stats as Stats, sport)
                            };
                            break;
                        case 'NFL':
                        case 'NCAA_FB':
                            advancedMetrics = {
                                ...calculateFootballMetrics(log.stats as Stats),
                                ...calculateUniversalMetrics(log.stats as Stats, sport)
                            };
                            break;
                        case 'MLB':
                            advancedMetrics = {
                                ...calculateBaseballMetrics(log.stats as Stats),
                                ...calculateUniversalMetrics(log.stats as Stats, sport)
                            };
                            break;
                        case 'NHL':
                            advancedMetrics = {
                                ...calculateHockeyMetrics(log.stats as Stats),
                                ...calculateUniversalMetrics(log.stats as Stats, sport)
                            };
                            break;
                    }
                }
                
                return {
                    id: log.id,
                    computed_metrics: advancedMetrics
                };
            });
            
            // Update in batches
            for (let i = 0; i < updates.length; i += 100) {
                const batch = updates.slice(i, i + 100);
                
                for (const update of batch) {
                    await supabase
                        .from('player_game_logs')
                        .update({ computed_metrics: update.computed_metrics })
                        .eq('id', update.id);
                }
                
                processedCount += batch.length;
            }
            
            console.log(`  Processed ${processedCount} ${sport} logs...`);
            
            if (logs.length < 1000) break;
            offset += 1000;
        }
        
        console.log(`✅ Completed ${sport}: ${processedCount} logs updated`);
    }
    
    console.log('\n\n🎉 ADVANCED METRICS CALCULATION COMPLETE!');
    
    // Refresh materialized view
    console.log('\n🔄 Refreshing materialized view...');
    await supabase.rpc('refresh_materialized_view', { 
        view_name: 'player_universal_metrics' 
    });
    
    console.log('✅ All done!');
}

// Add function to validate data completeness
async function validateDataCompleteness() {
    console.log('\n\n🔍 VALIDATING DATA COMPLETENESS');
    console.log('================================\n');
    
    // Check for missing opponent_ids
    const { count: missingOpponents } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('opponent_id', null);
        
    console.log(`Missing opponent_ids: ${missingOpponents || 0}`);
    
    // Check for logs without computed metrics
    const { count: missingMetrics } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .is('computed_metrics', null);
        
    console.log(`Missing computed_metrics: ${missingMetrics || 0}`);
    
    // Check distribution of advanced metrics
    const { data: sample } = await supabase
        .from('player_game_logs')
        .select('computed_metrics')
        .not('computed_metrics', 'is', null)
        .limit(100);
        
    if (sample && sample.length > 0) {
        const metricCounts = new Map<string, number>();
        
        sample.forEach(log => {
            if (log.computed_metrics) {
                Object.keys(log.computed_metrics).forEach(metric => {
                    metricCounts.set(metric, (metricCounts.get(metric) || 0) + 1);
                });
            }
        });
        
        console.log('\n📊 Advanced Metrics Coverage (from sample):');
        Array.from(metricCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([metric, count]) => {
                console.log(`  ${metric}: ${count}/${sample.length} (${(count/sample.length*100).toFixed(1)}%)`);
            });
    }
}

// Run the calculation
calculateAndStoreMetrics()
    .then(() => validateDataCompleteness())
    .catch(console.error);