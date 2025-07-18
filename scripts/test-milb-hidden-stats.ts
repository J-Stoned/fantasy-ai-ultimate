import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testHiddenStats() {
  console.log(chalk.cyan('🔍 Testing Hidden MiLB Stats Endpoints\n'));
  
  // Get a game without stats
  const { data: gamesWithoutStats } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MILB')
    .not('id', 'in', `(SELECT DISTINCT game_id FROM player_game_logs)`)
    .limit(5);
    
  if (!gamesWithoutStats || gamesWithoutStats.length === 0) {
    console.log('No games without stats found');
    return;
  }
  
  for (const game of gamesWithoutStats) {
    const gameId = game.external_id.replace('mlb_milb_', '');
    console.log(chalk.yellow(`\nTesting game ${gameId}...`));
    
    // Test 1: Linescore endpoint
    try {
      const linescoreResponse = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/linescore`);
      const linescore = linescoreResponse.data;
      
      console.log(chalk.green('✅ Linescore data found!'));
      console.log(`   Innings: ${linescore.innings?.length || 0}`);
      console.log(`   Home: ${linescore.teams?.home?.runs || 0} runs`);
      console.log(`   Away: ${linescore.teams?.away?.runs || 0} runs`);
      
      // Check for player data
      if (linescore.teams?.home?.players || linescore.teams?.away?.players) {
        console.log(chalk.cyan('   → Contains player data!'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Linescore failed'));
    }
    
    // Test 2: PlayByPlay endpoint
    try {
      const pbpResponse = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/playByPlay`);
      const pbp = pbpResponse.data;
      
      console.log(chalk.green('✅ Play-by-play data found!'));
      console.log(`   Total plays: ${pbp.allPlays?.length || 0}`);
      
      // Check for batter/pitcher info
      if (pbp.allPlays && pbp.allPlays.length > 0) {
        const firstPlay = pbp.allPlays[0];
        if (firstPlay.matchup?.batter || firstPlay.matchup?.pitcher) {
          console.log(chalk.cyan('   → Contains batter/pitcher data!'));
          console.log(`   → Batter: ${firstPlay.matchup.batter?.fullName}`);
          console.log(`   → Pitcher: ${firstPlay.matchup.pitcher?.fullName}`);
        }
      }
      
      // Look for boxscore data
      if (pbp.boxscore) {
        console.log(chalk.cyan('   → HAS BOXSCORE DATA IN PLAY-BY-PLAY!'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Play-by-play failed'));
    }
    
    // Test 3: Live feed endpoint (different structure)
    try {
      const liveResponse = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/feed/live`);
      const live = liveResponse.data;
      
      console.log(chalk.green('✅ Live feed data found!'));
      
      // Check for boxscore in live data
      if (live.liveData?.boxscore?.teams) {
        const teams = live.liveData.boxscore.teams;
        let playerCount = 0;
        
        ['away', 'home'].forEach(side => {
          const players = teams[side]?.players || {};
          playerCount += Object.keys(players).length;
          
          // Check first player for stats
          const firstPlayerId = Object.keys(players)[0];
          if (firstPlayerId && players[firstPlayerId].stats) {
            console.log(chalk.cyan(`   → ${side.toUpperCase()} team has player stats!`));
            const stats = players[firstPlayerId].stats;
            if (stats.batting) console.log(`      Batting stats: ${Object.keys(stats.batting).length} fields`);
            if (stats.pitching) console.log(`      Pitching stats: ${Object.keys(stats.pitching).length} fields`);
          }
        });
        
        console.log(chalk.cyan(`   → Total players with potential stats: ${playerCount}`));
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(chalk.yellow('⚠️  Live feed not available (404)'));
      } else {
        console.log(chalk.red('❌ Live feed failed:', error.message));
      }
    }
    
    // Only test first 2 games to avoid rate limiting
    if (gamesWithoutStats.indexOf(game) >= 1) break;
  }
  
  // Summary
  console.log(chalk.cyan('\n📊 DISCOVERY SUMMARY:'));
  console.log('1. The /linescore endpoint has basic game data');
  console.log('2. The /playByPlay endpoint has detailed play data with player IDs');
  console.log('3. The /feed/live endpoint MIGHT have full boxscore data for some games');
  console.log('4. We should check ALL games with /feed/live to find hidden stats!');
}

testHiddenStats().catch(console.error);