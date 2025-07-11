import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeLogQuality() {
    console.log('📊 ANALYZING LOG QUALITY & COMPLETENESS');
    console.log('======================================\n');
    
    // Get sample of recent logs
    console.log('Fetching sample of player logs...\n');
    
    const { data: sampleLogs } = await supabase
        .from('player_game_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (!sampleLogs || sampleLogs.length === 0) {
        console.log('No logs found!');
        return;
    }
    
    // Analyze stats structure
    console.log(`Analyzing ${sampleLogs.length} recent logs...\n`);
    
    // Track what stats we have
    const statsFound = new Map<string, number>();
    const statsByMinutes = {
        withMinutes: 0,
        zeroMinutes: 0,
        noMinutes: 0
    };
    const fantasyPointsAnalysis = {
        hasFantasyPoints: 0,
        zeroFantasyPoints: 0,
        noFantasyPoints: 0
    };
    
    // Analyze each log
    sampleLogs.forEach(log => {
        // Check minutes played
        if (log.minutes_played !== null && log.minutes_played !== undefined) {
            if (log.minutes_played > 0) {
                statsByMinutes.withMinutes++;
            } else {
                statsByMinutes.zeroMinutes++;
            }
        } else {
            statsByMinutes.noMinutes++;
        }
        
        // Check fantasy points
        if (log.fantasy_points !== null && log.fantasy_points !== undefined) {
            if (log.fantasy_points > 0) {
                fantasyPointsAnalysis.hasFantasyPoints++;
            } else {
                fantasyPointsAnalysis.zeroFantasyPoints++;
            }
        } else {
            fantasyPointsAnalysis.noFantasyPoints++;
        }
        
        // Analyze stats object
        if (log.stats && typeof log.stats === 'object') {
            Object.keys(log.stats).forEach(stat => {
                statsFound.set(stat, (statsFound.get(stat) || 0) + 1);
            });
        }
    });
    
    // Display results
    console.log('📈 STATS COVERAGE:');
    console.log('==================');
    
    const sortedStats = Array.from(statsFound.entries()).sort((a, b) => b[1] - a[1]);
    sortedStats.forEach(([stat, count]) => {
        const percentage = ((count / sampleLogs.length) * 100).toFixed(1);
        console.log(`${stat}: ${count}/${sampleLogs.length} (${percentage}%)`);
    });
    
    console.log('\n⏱️ MINUTES PLAYED:');
    console.log(`With minutes: ${statsByMinutes.withMinutes}`);
    console.log(`Zero minutes: ${statsByMinutes.zeroMinutes}`);
    console.log(`No minutes data: ${statsByMinutes.noMinutes}`);
    
    console.log('\n🎯 FANTASY POINTS:');
    console.log(`Has points: ${fantasyPointsAnalysis.hasFantasyPoints}`);
    console.log(`Zero points: ${fantasyPointsAnalysis.zeroFantasyPoints}`);
    console.log(`No points data: ${fantasyPointsAnalysis.noFantasyPoints}`);
    
    // Check a specific log in detail
    console.log('\n\n📋 SAMPLE LOG DETAILS:');
    console.log('=====================');
    const sampleLog = sampleLogs[0];
    console.log(`Game ID: ${sampleLog.game_id}`);
    console.log(`Player ID: ${sampleLog.player_id}`);
    console.log(`Date: ${sampleLog.game_date}`);
    console.log(`Minutes: ${sampleLog.minutes_played}`);
    console.log(`Fantasy Points: ${sampleLog.fantasy_points}`);
    console.log('\nStats object:');
    console.log(JSON.stringify(sampleLog.stats, null, 2));
    
    // Check for missing standard basketball stats
    console.log('\n\n⚠️  POTENTIAL MISSING STATS:');
    console.log('===========================');
    
    const expectedStats = [
        'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
        'fg_made', 'fg_attempted', 'fg_percentage',
        'three_made', 'three_attempted', 'three_percentage',
        'ft_made', 'ft_attempted', 'ft_percentage',
        'offensive_rebounds', 'defensive_rebounds',
        'fouls', 'plus_minus', 'starter', 'did_not_play'
    ];
    
    const missingStats = expectedStats.filter(stat => !statsFound.has(stat));
    if (missingStats.length > 0) {
        console.log('Stats we might be missing:');
        missingStats.forEach(stat => console.log(`  - ${stat}`));
    } else {
        console.log('✅ All expected stats are being collected!');
    }
    
    // Check for advanced stats we could add
    console.log('\n\n🚀 ADVANCED STATS WE COULD ADD:');
    console.log('===============================');
    const advancedStats = [
        'usage_rate', 'true_shooting_percentage', 'effective_fg_percentage',
        'assist_to_turnover_ratio', 'steal_percentage', 'block_percentage',
        'offensive_rating', 'defensive_rating', 'game_score',
        'double_double', 'triple_double', 'technical_fouls',
        'flagrant_fouls', 'ejected', 'bench_points', 'paint_points',
        'fast_break_points', 'second_chance_points'
    ];
    
    advancedStats.forEach(stat => {
        if (!statsFound.has(stat)) {
            console.log(`  - ${stat}`);
        }
    });
    
    // Get count by sport
    console.log('\n\n🏀 LOGS BY SPORT:');
    console.log('=================');
    
    const { data: sportCounts } = await supabase
        .from('player_game_logs')
        .select('game_id, games!inner(sport)')
        .limit(1000);
        
    const sportMap = new Map<string, number>();
    sportCounts?.forEach(log => {
        const sport = (log as any).games?.sport;
        if (sport) {
            sportMap.set(sport, (sportMap.get(sport) || 0) + 1);
        }
    });
    
    sportMap.forEach((count, sport) => {
        console.log(`${sport}: ${count} logs`);
    });
    
    // Final recommendations
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. Ensure all games calculate fantasy_points');
    console.log('2. Add missing standard stats if available from ESPN');
    console.log('3. Consider adding advanced stats for premium features');
    console.log('4. Verify opponent_id is populated for all logs');
    console.log('5. Add metadata like starter status, injury info');
}

analyzeLogQuality();