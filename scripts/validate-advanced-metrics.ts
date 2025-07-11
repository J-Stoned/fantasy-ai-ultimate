import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MetricValidation {
    sport: string;
    expectedMetrics: string[];
    sampleSize: number;
    results: {
        totalChecked: number;
        withMetrics: number;
        missingMetrics: string[];
        metricCoverage: Map<string, number>;
        averageMetricCount: number;
        issues: string[];
    };
}

class MetricValidator {
    // Define expected metrics for each sport
    private expectedMetrics: Record<string, string[]> = {
        'NBA': [
            'true_shooting_pct', 'effective_fg_pct', 'assist_to_turnover_ratio',
            'usage_rate', 'game_score', 'double_double', 'triple_double',
            'points_per_36', 'rebounds_per_36', 'assists_per_36'
        ],
        'NCAA_BB': [
            'true_shooting_pct', 'effective_fg_pct', 'assist_to_turnover_ratio',
            'usage_rate', 'game_score', 'double_double', 'triple_double',
            'points_per_36', 'rebounds_per_36', 'assists_per_36'
        ],
        'NFL': [
            'completion_pct', 'yards_per_attempt', 'touchdown_pct', 'passer_rating',
            'yards_per_carry', 'catch_rate', 'yards_per_target', 'all_purpose_yards'
        ],
        'NCAA_FB': [
            'completion_pct', 'yards_per_attempt', 'touchdown_pct', 'passer_rating',
            'yards_per_carry', 'catch_rate', 'yards_per_target', 'all_purpose_yards'
        ],
        'MLB': [
            'batting_average', 'on_base_pct', 'slugging_pct', 'ops',
            'era', 'whip', 'k_per_9', 'bb_per_9', 'k_bb_ratio'
        ],
        'NHL': [
            'points_total', 'shooting_pct', 'goals_per_60', 'assists_per_60',
            'points_per_60', 'hat_trick', 'faceoff_pct'
        ]
    };
    
    async validateSport(sport: string, sampleSize: number = 100): Promise<MetricValidation> {
        const validation: MetricValidation = {
            sport,
            expectedMetrics: this.expectedMetrics[sport] || [],
            sampleSize,
            results: {
                totalChecked: 0,
                withMetrics: 0,
                missingMetrics: [],
                metricCoverage: new Map(),
                averageMetricCount: 0,
                issues: []
            }
        };
        
        // Get sample logs
        const { data: sportGames } = await supabase
            .from('games')
            .select('id')
            .eq('sport', sport)
            .limit(100);
            
        if (!sportGames || sportGames.length === 0) {
            validation.results.issues.push(`No ${sport} games found`);
            return validation;
        }
        
        const gameIds = sportGames.map(g => g.id);
        
        // Get logs with metrics
        const { data: logs } = await supabase
            .from('player_game_logs')
            .select('id, computed_metrics, stats, opponent_id, is_home, fantasy_points')
            .in('game_id', gameIds)
            .not('computed_metrics', 'is', null)
            .limit(sampleSize);
            
        if (!logs || logs.length === 0) {
            validation.results.issues.push(`No logs with computed_metrics found for ${sport}`);
            return validation;
        }
        
        validation.results.totalChecked = logs.length;
        
        // Analyze each log
        let totalMetricCount = 0;
        const allFoundMetrics = new Set<string>();
        
        for (const log of logs) {
            // Check basic data quality
            if (!log.opponent_id) {
                validation.results.issues.push(`Log ${log.id} missing opponent_id`);
            }
            if (log.is_home === null) {
                validation.results.issues.push(`Log ${log.id} missing is_home`);
            }
            
            // Check computed metrics
            if (log.computed_metrics && typeof log.computed_metrics === 'object') {
                validation.results.withMetrics++;
                const metricKeys = Object.keys(log.computed_metrics);
                totalMetricCount += metricKeys.length;
                
                // Track which metrics we found
                metricKeys.forEach(metric => {
                    allFoundMetrics.add(metric);
                    validation.results.metricCoverage.set(
                        metric, 
                        (validation.results.metricCoverage.get(metric) || 0) + 1
                    );
                });
                
                // Validate metric values
                for (const [key, value] of Object.entries(log.computed_metrics)) {
                    if (typeof value === 'number' && !isFinite(value)) {
                        validation.results.issues.push(
                            `Log ${log.id} has invalid ${key}: ${value}`
                        );
                    }
                }
            }
        }
        
        // Calculate results
        validation.results.averageMetricCount = validation.results.withMetrics > 0 
            ? totalMetricCount / validation.results.withMetrics 
            : 0;
            
        // Find missing expected metrics
        validation.results.missingMetrics = validation.expectedMetrics.filter(
            metric => !allFoundMetrics.has(metric)
        );
        
        return validation;
    }
    
    async generateReport() {
        console.log('📊 ADVANCED METRICS VALIDATION REPORT');
        console.log('====================================\n');
        
        const sports = ['NBA', 'NCAA_BB', 'NFL', 'NCAA_FB', 'MLB', 'NHL'];
        const allValidations: MetricValidation[] = [];
        
        for (const sport of sports) {
            const validation = await this.validateSport(sport, 50);
            allValidations.push(validation);
            
            console.log(`\n${sport} Validation:`);
            console.log('─'.repeat(40));
            console.log(`Samples checked: ${validation.results.totalChecked}`);
            console.log(`With metrics: ${validation.results.withMetrics}`);
            console.log(`Average metrics per log: ${validation.results.averageMetricCount.toFixed(1)}`);
            
            if (validation.results.metricCoverage.size > 0) {
                console.log('\nMetric Coverage:');
                const sortedMetrics = Array.from(validation.results.metricCoverage.entries())
                    .sort((a, b) => b[1] - a[1]);
                    
                sortedMetrics.slice(0, 10).forEach(([metric, count]) => {
                    const pct = (count / validation.results.totalChecked * 100).toFixed(1);
                    console.log(`  ${metric}: ${count}/${validation.results.totalChecked} (${pct}%)`);
                });
            }
            
            if (validation.results.missingMetrics.length > 0) {
                console.log(`\n⚠️  Missing expected metrics: ${validation.results.missingMetrics.join(', ')}`);
            }
            
            if (validation.results.issues.length > 0) {
                console.log(`\n❌ Issues found: ${validation.results.issues.length}`);
                validation.results.issues.slice(0, 5).forEach(issue => {
                    console.log(`  - ${issue}`);
                });
            }
        }
        
        // Overall summary
        console.log('\n\n📈 OVERALL SUMMARY');
        console.log('==================');
        
        const totalSamples = allValidations.reduce((sum, v) => sum + v.results.totalChecked, 0);
        const totalWithMetrics = allValidations.reduce((sum, v) => sum + v.results.withMetrics, 0);
        const totalIssues = allValidations.reduce((sum, v) => sum + v.results.issues.length, 0);
        
        console.log(`Total samples: ${totalSamples}`);
        console.log(`With metrics: ${totalWithMetrics} (${(totalWithMetrics/totalSamples*100).toFixed(1)}%)`);
        console.log(`Total issues: ${totalIssues}`);
        
        // Check data completeness
        console.log('\n\n🎯 DATA COMPLETENESS CHECK');
        console.log('=========================');
        
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true });
            
        const { count: withMetrics } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .not('computed_metrics', 'is', null);
            
        const { count: withOpponent } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .not('opponent_id', 'is', null);
            
        const { count: withIsHome } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .not('is_home', 'is', null);
            
        console.log(`Total logs: ${totalLogs?.toLocaleString()}`);
        console.log(`With computed_metrics: ${withMetrics?.toLocaleString()} (${(withMetrics!/totalLogs!*100).toFixed(1)}%)`);
        console.log(`With opponent_id: ${withOpponent?.toLocaleString()} (${(withOpponent!/totalLogs!*100).toFixed(1)}%)`);
        console.log(`With is_home: ${withIsHome?.toLocaleString()} (${(withIsHome!/totalLogs!*100).toFixed(1)}%)`);
        
        const readyForAnalysis = Math.min(withMetrics || 0, withOpponent || 0, withIsHome || 0);
        console.log(`\n✅ Logs ready for pattern analysis: ${readyForAnalysis.toLocaleString()}`);
    }
    
    async spotCheckMetrics() {
        console.log('\n\n🔍 SPOT CHECK: Metric Calculations');
        console.log('==================================');
        
        // Get a few specific examples
        const { data: basketballLog } = await supabase
            .from('player_game_logs')
            .select('*')
            .not('computed_metrics', 'is', null)
            .not('stats->points', 'is', null)
            .limit(1)
            .single();
            
        if (basketballLog) {
            console.log('\nBasketball Example:');
            console.log(`Stats: ${JSON.stringify(basketballLog.stats, null, 2)}`);
            console.log(`Computed Metrics: ${JSON.stringify(basketballLog.computed_metrics, null, 2)}`);
            
            // Verify a calculation
            if (basketballLog.stats && basketballLog.computed_metrics) {
                const expectedTS = basketballLog.stats.points / 
                    (2 * (basketballLog.stats.fg_attempted + 0.44 * basketballLog.stats.ft_attempted));
                console.log(`\nTrue Shooting % Check:`);
                console.log(`  Expected: ${expectedTS.toFixed(3)}`);
                console.log(`  Actual: ${basketballLog.computed_metrics.true_shooting_pct?.toFixed(3)}`);
                console.log(`  Match: ${Math.abs(expectedTS - basketballLog.computed_metrics.true_shooting_pct) < 0.001 ? '✅' : '❌'}`);
            }
        }
    }
}

// Run validation
async function runValidation() {
    const validator = new MetricValidator();
    
    await validator.generateReport();
    await validator.spotCheckMetrics();
    
    console.log('\n\n✅ Validation complete!');
}

runValidation().catch(console.error);