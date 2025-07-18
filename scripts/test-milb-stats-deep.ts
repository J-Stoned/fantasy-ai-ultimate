import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deepTestMiLBStats() {
  console.log(chalk.cyan('🔍 Deep MiLB Stats Test\n'));
  
  // Get a sample of MiLB games from different dates
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'MILB')
    .in('league', ['Triple-A', 'Double-A'])
    .gte('start_time', '2024-06-01')
    .lte('start_time', '2024-07-31')
    .limit(10);
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(chalk.yellow(`Testing ${games.length} games...\n`));
  
  let gamesWithStats = 0;
  let totalPlayers = 0;
  
  for (const game of games) {
    const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
    const gameDate = new Date(game.start_time).toLocaleDateString();
    
    console.log(chalk.blue(`\n━━━ Game ${gameId} (${gameDate}) ━━━`));
    console.log(`${game.league}: Teams ${game.home_team_id} vs ${game.away_team_id}`);
    
    try {
      // 1. Check game feed
      const feedUrl = `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`;
      const feedResp = await axios.get(feedUrl);
      
      const gameData = feedResp.data.gameData;
      const liveData = feedResp.data.liveData;
      
      console.log(`Status: ${gameData.status.detailedState}`);
      console.log(`Home: ${gameData.teams.home.name}`);
      console.log(`Away: ${gameData.teams.away.name}`);
      
      // 2. Check boxscore
      const hasBoxscore = liveData?.boxscore?.teams?.away?.players && 
                         Object.keys(liveData.boxscore.teams.away.players).length > 0;
      
      if (hasBoxscore) {
        const awayPlayers = Object.keys(liveData.boxscore.teams.away.players);
        const homePlayers = Object.keys(liveData.boxscore.teams.home.players);
        
        console.log(chalk.green(`✅ Has boxscore: ${awayPlayers.length + homePlayers.length} players`));
        gamesWithStats++;
        totalPlayers += awayPlayers.length + homePlayers.length;
        
        // Sample a player's stats
        const samplePlayerId = awayPlayers[0];
        const samplePlayer = liveData.boxscore.teams.away.players[samplePlayerId];
        
        if (samplePlayer?.stats?.batting) {
          console.log(chalk.cyan('Sample batting stats:'));
          console.log(`  AB: ${samplePlayer.stats.batting.atBats}`);
          console.log(`  H: ${samplePlayer.stats.batting.hits}`);
          console.log(`  R: ${samplePlayer.stats.batting.runs}`);
          console.log(`  RBI: ${samplePlayer.stats.batting.rbi}`);
        }
      } else {
        console.log(chalk.red('❌ No boxscore data'));
        
        // Check why
        if (gameData.status.abstractGameState === 'Preview') {
          console.log(chalk.yellow('  Reason: Game not started yet'));
        } else if (gameData.status.statusCode === 'PW' || gameData.status.statusCode === 'PR') {
          console.log(chalk.yellow('  Reason: Warmup/Pre-game'));
        } else if (!liveData?.boxscore) {
          console.log(chalk.yellow('  Reason: No boxscore object at all'));
        } else {
          console.log(chalk.yellow('  Reason: Empty player data'));
        }
      }
      
    } catch (error: any) {
      console.log(chalk.red(`❌ API Error: ${error.message}`));
    }
  }
  
  console.log(chalk.cyan('\n\n━━━ SUMMARY ━━━'));
  console.log(`Games tested: ${games.length}`);
  console.log(`Games with stats: ${gamesWithStats} (${Math.round(gamesWithStats/games.length*100)}%)`);
  console.log(`Total players found: ${totalPlayers}`);
  console.log(`Average players per game: ${Math.round(totalPlayers/gamesWithStats) || 0}`);
}

deepTestMiLBStats().catch(console.error);