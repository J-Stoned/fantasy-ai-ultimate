import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyCoverage() {
    console.log('📊 VERIFYING SPORTS COVERAGE');
    console.log('============================\n');

    try {
        // NBA Coverage
        const { count: nbaGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'NBA')
            .gte('start_time', '2023-10-01');
            
        const { count: nbaLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .gte('game_date', '2023-10-01')
            .lte('game_date', '2024-06-30')
            .in('game_id', (await supabase
                .from('games')
                .select('id')
                .eq('sport', 'NBA')
                .gte('start_time', '2023-10-01')
                .lte('start_time', '2024-06-30')).data?.map(g => g.id) || []);
                
        console.log(`🏀 NBA 2023-24:`);
        console.log(`   Games: ${nbaGames}`);
        console.log(`   Logs: ${nbaLogs}`);
        console.log(`   Avg logs/game: ${nbaLogs && nbaGames ? (nbaLogs / nbaGames).toFixed(1) : 0}`);
        
        // MLB Coverage
        const { count: mlbGames2023 } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'MLB')
            .gte('start_time', '2023-03-01')
            .lte('start_time', '2023-11-30');
            
        const { count: mlbGames2024 } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'MLB')
            .gte('start_time', '2024-03-01')
            .lte('start_time', '2024-11-30');
            
        const { count: mlbLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .gte('game_date', '2023-03-01')
            .lte('game_date', '2024-11-30')
            .in('game_id', (await supabase
                .from('games')
                .select('id')
                .eq('sport', 'MLB')
                .gte('start_time', '2023-03-01')
                .lte('start_time', '2024-11-30')).data?.map(g => g.id) || []);
                
        console.log(`\n⚾ MLB 2023-24:`);
        console.log(`   2023 Games: ${mlbGames2023}`);
        console.log(`   2024 Games: ${mlbGames2024}`);
        console.log(`   Total Games: ${(mlbGames2023 || 0) + (mlbGames2024 || 0)}`);
        console.log(`   Logs: ${mlbLogs}`);
        console.log(`   Avg logs/game: ${mlbLogs && (mlbGames2023 || 0) + (mlbGames2024 || 0) ? (mlbLogs / ((mlbGames2023 || 0) + (mlbGames2024 || 0))).toFixed(1) : 0}`);
        
        // NHL Coverage
        const { count: nhlGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('sport', 'NHL');
            
        const { count: nhlLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .in('game_id', (await supabase
                .from('games')
                .select('id')
                .eq('sport', 'NHL')).data?.map(g => g.id) || []);
                
        console.log(`\n🏒 NHL All Seasons:`);
        console.log(`   Games: ${nhlGames}`);
        console.log(`   Logs: ${nhlLogs}`);
        console.log(`   Avg logs/game: ${nhlLogs && nhlGames ? (nhlLogs / nhlGames).toFixed(1) : 0}`);
        
        // Total Summary
        const { count: totalGames } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true });
            
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true });
            
        console.log(`\n📈 TOTAL SUMMARY:`);
        console.log(`   Total Games: ${totalGames?.toLocaleString()}`);
        console.log(`   Total Logs: ${totalLogs?.toLocaleString()}`);
        console.log(`   Overall avg logs/game: ${totalLogs && totalGames ? (totalLogs / totalGames).toFixed(1) : 0}`);
        console.log(`   Progress to 600K: ${totalLogs ? ((totalLogs / 600000) * 100).toFixed(1) : 0}%`);
        
        // Coverage calculation
        const nbaGamesCovered = nbaLogs && nbaGames ? (nbaLogs / (nbaGames * 15)).toFixed(1) : 0; // ~15 players per game
        const mlbGamesCovered = mlbLogs && ((mlbGames2023 || 0) + (mlbGames2024 || 0)) ? (mlbLogs / (((mlbGames2023 || 0) + (mlbGames2024 || 0)) * 25)).toFixed(1) : 0; // ~25 players per game
        const nhlGamesCovered = nhlLogs && nhlGames ? (nhlLogs / (nhlGames * 35)).toFixed(1) : 0; // ~35 players per game
        
        console.log(`\n✅ ESTIMATED COVERAGE:`);
        console.log(`   NBA: ~${(parseFloat(nbaGamesCovered.toString()) * 100).toFixed(0)}%`);
        console.log(`   MLB: ~${(parseFloat(mlbGamesCovered.toString()) * 100).toFixed(0)}%`);
        console.log(`   NHL: ~${(parseFloat(nhlGamesCovered.toString()) * 100).toFixed(0)}%`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyCoverage();