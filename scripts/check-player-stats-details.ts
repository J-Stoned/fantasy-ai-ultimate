import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPlayerStatsDetails() {
  console.log('🔍 PLAYER STATS DETAILED ANALYSIS 🔍\n');
  console.log('=' .repeat(60));
  
  try {
    // First, check what columns exist in player_stats
    const { data: sampleStats, error: sampleError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5);
    
    if (!sampleError && sampleStats && sampleStats.length > 0) {
      console.log('\n📋 PLAYER_STATS TABLE STRUCTURE:');
      console.log('-'.repeat(40));
      console.log('Columns:', Object.keys(sampleStats[0]).join(', '));
      
      // Check if sport column exists
      if ('sport' in sampleStats[0]) {
        console.log('\n✅ Sport column exists');
        
        // Get unique sports
        const { data: sports, error: sportsError } = await supabase
          .from('player_stats')
          .select('sport')
          .limit(1000);
        
        if (!sportsError && sports) {
          const uniqueSports = [...new Set(sports.map(s => s.sport).filter(Boolean))];
          console.log('Unique sports found:', uniqueSports.join(', '));
        }
      } else {
        console.log('\n❌ Sport column not found');
        
        // Check game_id structure to infer sport
        if ('game_id' in sampleStats[0]) {
          console.log('\nChecking game_id patterns to identify sports...');
          
          const { data: gameIdSample, error: gameIdError } = await supabase
            .from('player_stats')
            .select('game_id')
            .limit(100);
          
          if (!gameIdError && gameIdSample) {
            const sportCounts: Record<string, number> = {
              MLB: 0,
              NBA: 0,
              NFL: 0,
              NHL: 0,
              Unknown: 0
            };
            
            gameIdSample.forEach(row => {
              if (row.game_id && typeof row.game_id === 'string') {
                if (row.game_id.includes('MLB')) sportCounts.MLB++;
                else if (row.game_id.includes('NBA')) sportCounts.NBA++;
                else if (row.game_id.includes('NFL')) sportCounts.NFL++;
                else if (row.game_id.includes('NHL')) sportCounts.NHL++;
                else sportCounts.Unknown++;
              } else if (row.game_id) {
                // game_id might be a number or other type
                sportCounts.Unknown++;
              }
            });
            
            console.log('\nGame ID sport patterns (from 100 sample):');
            Object.entries(sportCounts).forEach(([sport, count]) => {
              if (count > 0) console.log(`- ${sport}: ${count}`);
            });
          }
        }
      }
      
      // Count total player_stats by different methods
      console.log('\n📊 PLAYER STATS COUNTS:');
      console.log('-'.repeat(40));
      
      // Total count
      const { count: totalCount, error: totalError } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true });
      
      console.log(`Total player_stats records: ${totalCount?.toLocaleString() || 'Error'}`);
      
      // Check if stats are linked to games
      const { count: withGameId, error: gameIdError } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .not('game_id', 'is', null);
      
      console.log(`Stats with game_id: ${withGameId?.toLocaleString() || 'Error'}`);
      
      // Check ESPN ID format
      const { data: espnIdSample, error: espnError } = await supabase
        .from('player_stats')
        .select('espn_id')
        .not('espn_id', 'is', null)
        .limit(10);
      
      if (!espnError && espnIdSample) {
        console.log('\nSample ESPN IDs:');
        espnIdSample.forEach(row => {
          console.log(`- ${row.espn_id}`);
        });
      }
      
      // Check date range of stats
      const { data: dateRange, error: dateError } = await supabase
        .from('player_stats')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);
      
      const { data: latestDate, error: latestError } = await supabase
        .from('player_stats')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!dateError && dateRange && dateRange[0] && !latestError && latestDate && latestDate[0]) {
        console.log(`\nDate range: ${new Date(dateRange[0].created_at).toLocaleDateString()} to ${new Date(latestDate[0].created_at).toLocaleDateString()}`);
      }
      
    } else {
      console.log('Error fetching player_stats sample:', sampleError);
    }
    
  } catch (error) {
    console.error('Error checking player stats details:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ PLAYER STATS ANALYSIS COMPLETE\n');
}

// Run the check
checkPlayerStatsDetails();