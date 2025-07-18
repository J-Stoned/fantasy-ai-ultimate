import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyMissingStats() {
  console.log(chalk.cyan('🔍 Verifying MiLB Missing Stats Issue\n'));
  
  // Get games we think don't have stats
  const { data: games } = await supabase.rpc('get_games_without_stats', {
    sport_filter: 'MILB',
    limit_count: 10
  }).select('*');
  
  // If RPC doesn't exist, use alternative query
  const { data: milbGames } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MILB')
    .limit(10);
    
  if (!milbGames || milbGames.length === 0) {
    console.log('No MiLB games found');
    return;
  }
  
  // Check which games have stats in our DB
  const gameIds = milbGames.map(g => g.id);
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds);
    
  const gamesWithStatsSet = new Set(gamesWithStats?.map(s => s.game_id) || []);
  const gamesWithoutStats = milbGames.filter(g => !gamesWithStatsSet.has(g.id));
  
  console.log(chalk.yellow(`Games without stats in DB: ${gamesWithoutStats.length}/${milbGames.length}\n`));
  
  // Now check if these games actually have stats in the API
  let actuallyHaveStats = 0;
  
  for (const game of gamesWithoutStats.slice(0, 5)) {
    const gameId = game.external_id.replace('mlb_milb_', '');
    console.log(chalk.blue(`\nChecking game ${gameId}...`));
    
    try {
      const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`);
      const boxscore = response.data;
      
      let hasStats = false;
      let playerCount = 0;
      
      if (boxscore.teams) {
        ['away', 'home'].forEach(side => {
          const players = boxscore.teams[side]?.players || {};
          const playerIds = Object.keys(players);
          
          if (playerIds.length > 0) {
            // Check if first player has actual stats
            const firstPlayer = players[playerIds[0]];
            if (firstPlayer?.stats?.batting || firstPlayer?.stats?.pitching) {
              hasStats = true;
              playerCount += playerIds.length;
            }
          }
        });
      }
      
      if (hasStats) {
        console.log(chalk.green(`✅ Game HAS stats! ${playerCount} players found`));
        actuallyHaveStats++;
        
        // Show sample stats
        const awayPlayers = Object.values(boxscore.teams.away?.players || {});
        const samplePlayer: any = awayPlayers[0];
        if (samplePlayer?.stats?.batting) {
          console.log(chalk.cyan(`   Sample batting stats: ${Object.keys(samplePlayer.stats.batting).length} fields`));
        }
      } else {
        console.log(chalk.red(`❌ No player stats found`));
      }
      
    } catch (error: any) {
      console.log(chalk.red(`❌ API Error: ${error.message}`));
    }
  }
  
  if (actuallyHaveStats > 0) {
    console.log(chalk.yellow(`\n⚠️  DISCOVERY: ${actuallyHaveStats} games have stats in API but not in our DB!`));
    console.log(chalk.green('We need to re-run collection with better error handling!'));
  }
  
  // Check our collection logic
  console.log(chalk.cyan('\n\n📊 CHECKING OUR COLLECTION LOGIC...'));
  
  // Test with a known game
  const testGameId = gamesWithoutStats[0]?.external_id.replace('mlb_milb_', '');
  if (testGameId) {
    try {
      const response = await axios.get(`https://statsapi.mlb.com/api/v1/game/${testGameId}/boxscore`);
      const boxscore = response.data;
      
      console.log('\nBoxscore structure:');
      console.log('- teams:', !!boxscore.teams);
      console.log('- teams.away:', !!boxscore.teams?.away);
      console.log('- teams.away.players:', !!boxscore.teams?.away?.players);
      
      const awayPlayers = boxscore.teams?.away?.players || {};
      const firstPlayerId = Object.keys(awayPlayers)[0];
      
      if (firstPlayerId) {
        console.log(`\nFirst player ID format: ${firstPlayerId}`);
        const player = awayPlayers[firstPlayerId];
        console.log('Player has stats:', !!player.stats);
        console.log('Player has batting:', !!player.stats?.batting);
        console.log('Player has pitching:', !!player.stats?.pitching);
      }
    } catch (error) {
      console.log('Test game failed');
    }
  }
}

verifyMissingStats().catch(console.error);